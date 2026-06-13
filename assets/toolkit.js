(function () {
    const PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
    }

    function initDarkMode() {
        const html = document.documentElement;
        const darkModeToggle = document.getElementById('darkModeToggle');
        const sunIcon = document.getElementById('sunIcon');
        const moonIcon = document.getElementById('moonIcon');

        if (!darkModeToggle) return;

        if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            html.classList.add('dark');
            if (sunIcon) sunIcon.classList.remove('hidden');
            if (moonIcon) moonIcon.classList.add('hidden');
        }

        darkModeToggle.addEventListener('click', () => {
            html.classList.toggle('dark');
            const isDark = html.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            if (sunIcon) sunIcon.classList.toggle('hidden', !isDark);
            if (moonIcon) moonIcon.classList.toggle('hidden', isDark);
        });
    }

    function initUniversalToolPage() {
        const body = document.body;
        const toolType = body.dataset.toolType;

        if (toolType === 'pdf-editor') {
            initPdfEditorPage();
            return;
        }

        const config = TOOL_CONFIGS[toolType];

        if (!config) return;

        const fileInput = document.getElementById('fileInput');
        const convertBtn = document.getElementById('convertBtn');
        const resetBtn = document.getElementById('resetBtn');
        const downloadResultBtn = document.getElementById('downloadResultBtn');
        const fileSection = document.getElementById('fileSection');
        const resultsSection = document.getElementById('resultsSection');
        const previewList = document.getElementById('previewList');
        const statusMessage = document.getElementById('statusMessage');
        const resultTitle = document.getElementById('resultTitle');
        const resultDetails = document.getElementById('resultDetails');
        const resultSize = document.getElementById('resultSize');

        if (!fileInput || !convertBtn) return;

        let currentFiles = [];
        let lastBlob = null;
        let lastFilename = '';

        convertBtn.addEventListener('click', async () => {
            if (!currentFiles.length) {
                fileInput.click();
                return;
            }

            try {
                setButtonLoading(convertBtn, true, 'Converting...');
                setStatus('Working locally in your browser. Large files may take a moment.');
                const result = await config.convert(currentFiles, {
                    baseName: getBaseName(currentFiles[0].name),
                    progress: (message) => setStatus(message)
                });

                lastBlob = result.blob;
                lastFilename = result.filename || getDefaultFilename(currentFiles[0].name, config.outputExtension);
                downloadBlob(lastBlob, lastFilename);

                const totalSize = currentFiles.reduce((sum, file) => sum + file.size, 0);
                resultTitle.textContent = `${config.name} complete`;
                resultDetails.textContent = result.summary || `Your ${config.outputLabel} file is ready.`;
                resultSize.textContent = formatFileSize(totalSize);
                resultsSection.classList.remove('hidden');
                resultsSection.classList.add('animate-fade-in-up');
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (error) {
                console.error(error);
                setStatus(error.message || `Conversion failed. Please try another file.`);
                alert(error.message || 'Conversion failed. Please try another file.');
            } finally {
                setButtonLoading(convertBtn, false, config.buttonText || 'Convert');
            }
        });

        resetBtn.addEventListener('click', () => {
            currentFiles = [];
            lastBlob = null;
            lastFilename = '';
            fileInput.value = '';
            fileSection.classList.add('hidden');
            resultsSection.classList.add('hidden');
            previewList.innerHTML = '';
            setStatus('Choose a file to start.');
        });

        downloadResultBtn.addEventListener('click', () => {
            if (lastBlob && lastFilename) {
                downloadBlob(lastBlob, lastFilename);
            }
        });

        fileInput.addEventListener('change', () => {
            handleFiles(Array.from(fileInput.files || []));
        });

        const dropZone = document.getElementById('uploadZone');
        if (dropZone) {
            dropZone.addEventListener('click', () => fileInput.click());
            dropZone.addEventListener('dragover', (event) => {
                event.preventDefault();
                dropZone.classList.add('border-foreground/30');
            });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-foreground/30'));
            dropZone.addEventListener('drop', (event) => {
                event.preventDefault();
                dropZone.classList.remove('border-foreground/30');
                handleFiles(Array.from(event.dataTransfer.files || []));
            });
        }

        function handleFiles(files) {
            if (!files.length) return;

            if (config.maxFiles === 1) {
                currentFiles = [files[0]];
            } else {
                currentFiles = files;
            }

            fileSection.classList.remove('hidden');
            fileSection.classList.add('animate-fade-in-up');
            resultsSection.classList.add('hidden');
            renderPreview(currentFiles);
            setStatus(`${currentFiles.length} file${currentFiles.length === 1 ? '' : 's'} ready.`);
            fileSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function renderPreview(files) {
            previewList.innerHTML = '';

            files.forEach((file) => {
                const item = document.createElement('div');
                item.className = 'flex items-center gap-3 rounded-lg border border-border bg-muted/5 p-3 dark:bg-white/5 dark:border-border-dark';
                item.innerHTML = `
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted/10">
                        <svg class="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium dark:text-foreground-dark">${escapeHtml(file.name)}</p>
                        <p class="text-xs text-muted-foreground">${formatFileSize(file.size)}</p>
                    </div>
                `;
                previewList.appendChild(item);
            });
        }

        function setStatus(message) {
            if (statusMessage) statusMessage.textContent = message;
        }
    }

    function initPdfEditorPage() {
        const fileInput = document.getElementById('fileInput');
        const uploadZone = document.getElementById('uploadZone');
        const fileSection = document.getElementById('fileSection');
        const previewList = document.getElementById('previewList');
        const statusMessage = document.getElementById('statusMessage');
        const editBtn = document.getElementById('editBtn');
        const resetBtn = document.getElementById('resetBtn');
        const downloadResultBtn = document.getElementById('downloadResultBtn');
        const resultsSection = document.getElementById('resultsSection');
        const resultTitle = document.getElementById('resultTitle');
        const resultDetails = document.getElementById('resultDetails');
        const resultSize = document.getElementById('resultSize');
        const previewCanvas = document.getElementById('pdfEditorPreviewCanvas');
        const canvasScroller = document.getElementById('pdfEditorCanvasScroller');
        const previewMeta = document.getElementById('pdfEditorPreviewMeta');
        const pageCountEl = document.getElementById('pdfEditorPageCount');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const resetViewBtn = document.getElementById('resetViewBtn');
        const zoomValue = document.getElementById('zoomValue');
        const rotateLeftBtn = document.getElementById('rotateLeftBtn');
        const rotateRightBtn = document.getElementById('rotateRightBtn');
        const moveUpBtn = document.getElementById('moveUpBtn');
        const moveDownBtn = document.getElementById('moveDownBtn');
        const deletePageBtn = document.getElementById('deletePageBtn');
        const addPageBtn = document.getElementById('addPageBtn');
        const addTextBtn = document.getElementById('addTextBtn');
        const addImageBtn = document.getElementById('addImageBtn');
        const textInput = document.getElementById('pdfEditorTextInput');
        const textSizeInput = document.getElementById('pdfEditorTextSize');
        const xInput = document.getElementById('pdfEditorX');
        const yInput = document.getElementById('pdfEditorY');
        const colorInput = document.getElementById('pdfEditorColor');
        const imageInput = document.getElementById('pdfEditorImageInput');
        const imageWidthInput = document.getElementById('pdfEditorImageWidth');
        const imageXInput = document.getElementById('pdfEditorImageX');
        const imageYInput = document.getElementById('pdfEditorImageY');

        if (!fileInput || !editBtn || !previewList) return;

        let currentFile = null;
        let pdfBytes = null;
        let pdfDoc = null;
        let selectedPageNumber = 1;
        let isBusy = false;
        let previewZoom = 1.25;
        let isPanning = false;
        let panStartX = 0;
        let panStartY = 0;
        let panScrollX = 0;
        let panScrollY = 0;

        function setStatus(message) {
            if (statusMessage) statusMessage.textContent = message;
        }

        function setBusy(value, message) {
            isBusy = value;
            [rotateLeftBtn, rotateRightBtn, moveUpBtn, moveDownBtn, deletePageBtn, addPageBtn, addTextBtn, addImageBtn, editBtn, resetBtn, imageInput].forEach((button) => {
                if (button) button.disabled = value;
            });
            setButtonLoading(editBtn, value, message || 'Saving edits...');
            updateEditorControls();
            if (message) setStatus(message);
        }

        function updateEditorControls() {
            const hasPdf = Boolean(pdfDoc && pdfBytes);
            [rotateLeftBtn, rotateRightBtn, moveUpBtn, moveDownBtn, deletePageBtn, addPageBtn, addTextBtn, addImageBtn, editBtn, imageInput].forEach((button) => {
                if (button) button.disabled = !hasPdf || isBusy;
            });
        }

        async function loadPdf() {
            const PDFLib = requireGlobal('PDFLib', 'PDF editing');
            pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
            selectedPageNumber = Math.min(selectedPageNumber, pdfDoc.getPageCount());
            previewZoom = 1.25;
            resetPreviewPan();
            pageCountEl.textContent = `${pdfDoc.getPageCount()} page${pdfDoc.getPageCount() === 1 ? '' : 's'}`;
            updateEditorControls();
            await renderPageList();
            await renderPreview(selectedPageNumber);
        }

        async function handleFiles(files) {
            const file = Array.from(files || []).find((item) => item.type === 'application/pdf' || /\.pdf$/i.test(item.name));

            if (!file) {
                alert('Please choose a PDF file.');
                return;
            }

            currentFile = file;
            fileSection.classList.remove('hidden');
            fileSection.classList.add('animate-fade-in-up');
            resultsSection.classList.add('hidden');
            setStatus('Loading PDF...');
            fileSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

            try {
                pdfBytes = new Uint8Array(await file.arrayBuffer());
                selectedPageNumber = 1;
                await loadPdf();
                setStatus(`Ready. Select a page to edit ${currentFile.name}.`);
            } catch (error) {
                console.error(error);
                setStatus('Failed to load PDF. Try another file.');
                alert(error.message || 'Failed to load PDF.');
            }
        }

        async function renderPageList() {
            if (!pdfDoc || !pdfBytes) return;

            previewList.innerHTML = '';

            for (let pageNumber = 1; pageNumber <= pdfDoc.getPageCount(); pageNumber += 1) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'group rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-border-strong dark:bg-background-dark dark:border-border-dark';
                if (pageNumber === selectedPageNumber) {
                    button.classList.add('ring-2', 'ring-foreground/20', 'border-foreground/30');
                }

                const canvas = document.createElement('canvas');
                canvas.className = 'page-thumb mb-3';
                button.appendChild(canvas);

                const title = document.createElement('p');
                title.className = 'truncate text-sm font-medium dark:text-foreground-dark';
                title.textContent = `Page ${pageNumber}`;

                const meta = document.createElement('p');
                meta.className = 'mt-1 text-xs text-muted-foreground';
                meta.textContent = pageNumber === selectedPageNumber ? 'Selected' : 'Click to select';

                button.appendChild(title);
                button.appendChild(meta);
                button.addEventListener('click', async () => {
                    if (isBusy || pageNumber === selectedPageNumber) return;
                    selectedPageNumber = pageNumber;
                    await renderPageList();
                    await renderPreview(pageNumber);
                    setStatus(`Selected page ${pageNumber}.`);
                });

                previewList.appendChild(button);
                renderPageThumbnail(pageNumber, canvas);
            }
        }

        async function renderPageThumbnail(pageNumber, canvas) {
            try {
                const pdfjsLib = requireGlobal('pdfjsLib', 'PDF preview');
                const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale: 0.24 });
                canvas.width = Math.max(1, Math.floor(viewport.width));
                canvas.height = Math.max(1, Math.floor(viewport.height));
                const context = canvas.getContext('2d');
                if (!context) return;
                await page.render({ canvasContext: context, viewport }).promise;
                if (typeof pdf.destroy === 'function') pdf.destroy();
            } catch (error) {
                console.error(error);
            }
        }

        async function renderPreview(pageNumber) {
            if (!previewCanvas || !pdfDoc || !pdfBytes) return;

            try {
                const pdfjsLib = requireGlobal('pdfjsLib', 'PDF preview');
                const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
                const page = await pdf.getPage(pageNumber);
                const baseScale = 1.25;
                const viewport = page.getViewport({ scale: baseScale });
                const canvasWidth = Math.max(1, Math.floor(viewport.width));
                const canvasHeight = Math.max(1, Math.floor(viewport.height));
                previewCanvas.width = canvasWidth;
                previewCanvas.height = canvasHeight;
                previewCanvas.dataset.baseWidth = String(canvasWidth);
                previewCanvas.dataset.baseHeight = String(canvasHeight);
                updatePreviewZoom();
                const context = previewCanvas.getContext('2d');
                if (!context) throw new Error('Canvas is not available in this browser.');
                await page.render({ canvasContext: context, viewport }).promise;
                previewMeta.textContent = `Page ${pageNumber} of ${pdfDoc.getPageCount()} · ${Math.round(previewZoom * 100)}%`;
                if (typeof pdf.destroy === 'function') pdf.destroy();
            } catch (error) {
                console.error(error);
                previewMeta.textContent = `Page ${pageNumber}`;
            }
        }

        function resetPreviewPan() {
            if (!canvasScroller) return;
            canvasScroller.scrollLeft = 0;
            canvasScroller.scrollTop = 0;
            canvasScroller.classList.remove('is-panning');
        }

        function updatePreviewZoom() {
            if (!previewCanvas) return;
            previewZoom = clamp(previewZoom, 0.25, 4);
            const baseWidth = parseFloat(previewCanvas.dataset.baseWidth || '0') || previewCanvas.width;
            const baseHeight = parseFloat(previewCanvas.dataset.baseHeight || '0') || previewCanvas.height;
            previewCanvas.style.width = `${Math.max(1, Math.floor(baseWidth * previewZoom))}px`;
            previewCanvas.style.height = `${Math.max(1, Math.floor(baseHeight * previewZoom))}px`;
            if (zoomValue) zoomValue.textContent = `${Math.round(previewZoom * 100)}%`;
            if (pdfDoc) previewMeta.textContent = `Page ${selectedPageNumber} of ${pdfDoc.getPageCount()} · ${Math.round(previewZoom * 100)}%`;
        }

        function zoomPreviewAt(clientX, clientY, factor) {
            if (!canvasScroller || !previewCanvas) return;
            const oldZoom = previewZoom;
            const newZoom = clamp(oldZoom * factor, 0.25, 4);
            const scrollerRect = canvasScroller.getBoundingClientRect();
            const cursorX = clientX - scrollerRect.left;
            const cursorY = clientY - scrollerRect.top;
            const pointX = cursorX + canvasScroller.scrollLeft;
            const pointY = cursorY + canvasScroller.scrollTop;
            previewZoom = newZoom;
            updatePreviewZoom();
            canvasScroller.scrollLeft = pointX * (newZoom / oldZoom) - cursorX;
            canvasScroller.scrollTop = pointY * (newZoom / oldZoom) - cursorY;
        }

        async function embedImageFile(pdfDoc, file) {
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (file.type === 'image/png' || /\.png$/i.test(file.name)) return pdfDoc.embedPng(bytes);
            if (file.type === 'image/jpeg' || file.type === 'image/jpg' || /\.jpe?g$/i.test(file.name)) return pdfDoc.embedJpg(bytes);
            const blob = await imageFileToJpegBlob(file);
            return pdfDoc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        }

        async function applyEdit(operation) {
            if (!pdfDoc || !pdfBytes) {
                alert('Choose a PDF first.');
                return;
            }

            if (isBusy) return;

            const PDFLib = requireGlobal('PDFLib', 'PDF editing');
            const pageIndex = selectedPageNumber - 1;
            const pageCount = pdfDoc.getPageCount();

            try {
                setBusy(true, 'Saving edit...');

                if (operation === 'add-page') {
                    pdfDoc.addPage([595.28, 841.89], pageIndex + 1);
                    selectedPageNumber = pageIndex + 2;
                } else if (operation === 'rotate-left') {
                    const page = pdfDoc.getPage(pageIndex);
                    const angle = page.getRotation().angle;
                    page.setRotation(PDFLib.degrees((angle + 270) % 360));
                } else if (operation === 'rotate-right') {
                    const page = pdfDoc.getPage(pageIndex);
                    const angle = page.getRotation().angle;
                    page.setRotation(PDFLib.degrees((angle + 90) % 360));
                } else if (operation === 'move-up') {
                    if (pageIndex === 0) throw new Error('This is already the first page.');
                    pdfDoc.movePage(pageIndex, pageIndex - 1);
                    selectedPageNumber = pageIndex;
                } else if (operation === 'move-down') {
                    if (pageIndex >= pageCount - 1) throw new Error('This is already the last page.');
                    pdfDoc.movePage(pageIndex, pageIndex + 1);
                    selectedPageNumber = pageIndex + 2;
                } else if (operation === 'delete-page') {
                    if (pageCount <= 1) throw new Error('A PDF must have at least one page.');
                    pdfDoc.removePage(pageIndex);
                    selectedPageNumber = Math.min(selectedPageNumber, pdfDoc.getPageCount());
                } else if (operation === 'add-text') {
                    const text = textInput.value.trim();
                    if (!text) throw new Error('Enter text to add.');
                    const page = pdfDoc.getPage(pageIndex);
                    const pageSize = page.getSize();
                    const width = pageSize.width;
                    const height = pageSize.height;
                    const fontSize = clamp(parseFloat(textSizeInput.value) || 14, 6, 72);
                    const x = clamp(parseFloat(xInput.value) || 48, 24, Math.max(24, width - 24));
                    const y = clamp(parseFloat(yInput.value) || 48, 24, Math.max(24, height - 24));
                    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
                    const color = hexToRgb(colorInput.value || '#111111');
                    page.drawText(text, {
                        x,
                        y,
                        size: fontSize,
                        font,
                        color: PDFLib.rgb(color.r, color.g, color.b)
                    });
                } else if (operation === 'add-image') {
                    const imageFile = imageInput.files && imageInput.files[0];
                    if (!imageFile) throw new Error('Choose an image to add.');
                    if (!/^(image\/(png|jpeg)|image\/jpg)$/i.test(imageFile.type) && !/\.(png|jpe?g)$/i.test(imageFile.name)) {
                        throw new Error('Choose a PNG or JPG image.');
                    }
                    const page = pdfDoc.getPage(pageIndex);
                    const pageSize = page.getSize();
                    const requestedWidth = clamp(parseFloat(imageWidthInput.value) || 120, 12, Math.max(12, pageSize.width - 48));
                    const maxImageHeight = Math.max(24, pageSize.height - 48);
                    const image = await embedImageFile(pdfDoc, imageFile);
                    const fittedHeight = Math.min(image.height * (requestedWidth / image.width), maxImageHeight);
                    const fittedWidth = image.width * (fittedHeight / image.height);
                    const x = clamp(parseFloat(imageXInput.value) || 48, 24, Math.max(24, pageSize.width - fittedWidth - 24));
                    const y = clamp(parseFloat(imageYInput.value) || 48, 24, Math.max(24, pageSize.height - fittedHeight - 24));
                    page.drawImage(image, {
                        x,
                        y,
                        width: fittedWidth,
                        height: fittedHeight
                    });
                }

                pdfBytes = new Uint8Array(await pdfDoc.save());
                await loadPdf();
                if (imageInput) imageInput.value = '';
                setStatus('Edit saved. Continue editing or download the PDF.');
            } catch (error) {
                console.error(error);
                setStatus(error.message || 'Edit failed. Please try again.');
                alert(error.message || 'Edit failed. Please try again.');
            } finally {
                setBusy(false);
            }
        }

        async function saveAndDownload() {
            if (!pdfDoc || !pdfBytes) {
                alert('Choose a PDF first.');
                return;
            }

            if (isBusy) return;

            try {
                setBusy(true, 'Saving PDF...');
                pdfBytes = new Uint8Array(await pdfDoc.save());
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const filename = `${getBaseName(currentFile.name)}-edited.pdf`;
                downloadBlob(blob, filename);

                resultTitle.textContent = 'PDF edited';
                resultDetails.textContent = 'Your edited PDF is ready to download.';
                resultSize.textContent = formatFileSize(blob.size);
                resultsSection.classList.remove('hidden');
                resultsSection.classList.add('animate-fade-in-up');
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setStatus('PDF saved and downloaded.');
            } catch (error) {
                console.error(error);
                setStatus(error.message || 'Failed to save PDF.');
                alert(error.message || 'Failed to save PDF.');
            } finally {
                setBusy(false);
            }
        }

        function resetEditor() {
            currentFile = null;
            pdfBytes = null;
            pdfDoc = null;
            selectedPageNumber = 1;
            previewZoom = 1.25;
            isBusy = false;
            isPanning = false;
            fileInput.value = '';
            if (imageInput) imageInput.value = '';
            previewList.innerHTML = '';
            if (previewCanvas) {
                previewCanvas.width = 1;
                previewCanvas.height = 1;
            }
            resetPreviewPan();
            if (previewMeta) previewMeta.textContent = '';
            if (pageCountEl) pageCountEl.textContent = '';
            if (zoomValue) zoomValue.textContent = '125%';
            fileSection.classList.add('hidden');
            resultsSection.classList.add('hidden');
            updateEditorControls();
            setStatus('Choose a PDF to start editing.');
        }

        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', (event) => {
            event.preventDefault();
            uploadZone.classList.add('border-foreground/30');
        });
        uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('border-foreground/30'));
        uploadZone.addEventListener('drop', (event) => {
            event.preventDefault();
            uploadZone.classList.remove('border-foreground/30');
            handleFiles(Array.from(event.dataTransfer.files || []));
        });
        fileInput.addEventListener('change', () => handleFiles(Array.from(fileInput.files || [])));
        rotateLeftBtn?.addEventListener('click', () => applyEdit('rotate-left'));
        rotateRightBtn?.addEventListener('click', () => applyEdit('rotate-right'));
        moveUpBtn?.addEventListener('click', () => applyEdit('move-up'));
        moveDownBtn?.addEventListener('click', () => applyEdit('move-down'));
        deletePageBtn?.addEventListener('click', () => {
            if (!pdfDoc || pdfDoc.getPageCount() <= 1) {
                alert('A PDF must have at least one page.');
                return;
            }
            if (confirm('Delete this page from the PDF?')) {
                applyEdit('delete-page');
            }
        });
        addPageBtn?.addEventListener('click', () => applyEdit('add-page'));
        addTextBtn?.addEventListener('click', () => applyEdit('add-text'));
        addImageBtn?.addEventListener('click', () => applyEdit('add-image'));
        zoomOutBtn?.addEventListener('click', () => {
            if (!canvasScroller) return;
            const rect = canvasScroller.getBoundingClientRect();
            zoomPreviewAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.85);
        });
        zoomInBtn?.addEventListener('click', () => {
            if (!canvasScroller) return;
            const rect = canvasScroller.getBoundingClientRect();
            zoomPreviewAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.15);
        });
        resetViewBtn?.addEventListener('click', () => {
            previewZoom = 1.25;
            resetPreviewPan();
            updatePreviewZoom();
        });
        canvasScroller?.addEventListener('wheel', (event) => {
            event.preventDefault();
            zoomPreviewAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.001));
        }, { passive: false });
        canvasScroller?.addEventListener('pointerdown', (event) => {
            if (isBusy) return;
            isPanning = true;
            panStartX = event.clientX;
            panStartY = event.clientY;
            panScrollX = canvasScroller.scrollLeft;
            panScrollY = canvasScroller.scrollTop;
            canvasScroller.classList.add('is-panning');
            canvasScroller.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        });
        canvasScroller?.addEventListener('pointermove', (event) => {
            if (!isPanning) return;
            const deltaX = event.clientX - panStartX;
            const deltaY = event.clientY - panStartY;
            canvasScroller.scrollLeft = panScrollX - deltaX;
            canvasScroller.scrollTop = panScrollY - deltaY;
            event.preventDefault();
        });
        canvasScroller?.addEventListener('pointerup', () => {
            isPanning = false;
            canvasScroller.classList.remove('is-panning');
        });
        canvasScroller?.addEventListener('pointercancel', () => {
            isPanning = false;
            canvasScroller.classList.remove('is-panning');
        });
        editBtn.addEventListener('click', saveAndDownload);
        resetBtn.addEventListener('click', resetEditor);
        downloadResultBtn?.addEventListener('click', () => {
            if (pdfBytes) downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), `${getBaseName(currentFile.name)}-edited.pdf`);
        });

        updateEditorControls();
        setStatus('Choose a PDF to start editing.');
    }

    const TOOL_CONFIGS = {
        'pdf-to-word': {
            name: 'PDF to Word',
            outputExtension: 'docx',
            outputLabel: 'DOCX',
            buttonText: 'Convert to Word',
            maxFiles: 1,
            convert: async (files) => {
                const parsed = await extractPdfText(files[0]);
                const blob = await createDocxFromText(parsed);
                return {
                    blob,
                    filename: `${getBaseName(files[0].name)}-converted.docx`,
                    summary: 'A styled Word document was created from the PDF content.'
                };
            }
        },
        'pdf-to-excel': {
            name: 'PDF to Excel',
            outputExtension: 'xlsx',
            outputLabel: 'XLSX',
            buttonText: 'Convert to Excel',
            maxFiles: 1,
            convert: async (files) => {
                const blocks = await extractPdfTextBlocks(files[0]);
                const blob = await createExcelFromPdfText(blocks);
                return {
                    blob,
                    filename: `${getBaseName(files[0].name)}-converted.xlsx`,
                    summary: 'PDF text was placed into a spreadsheet with page numbers and text rows.'
                };
            }
        },
        'word-to-pdf': {
            name: 'Word to PDF',
            outputExtension: 'pdf',
            outputLabel: 'PDF',
            buttonText: 'Convert to PDF',
            maxFiles: 1,
            convert: async (files) => {
                const text = await extractDocxText(files[0]);
                const blob = await createPdfFromText(text || 'No text could be extracted from this Word document.');
                return {
                    blob,
                    filename: `${getBaseName(files[0].name)}-converted.pdf`,
                    summary: 'A simple PDF was created from the Word document text.'
                };
            }
        },
        'pdf-to-images': {
            name: 'PDF to Images',
            outputExtension: 'zip',
            outputLabel: 'PNG zip',
            buttonText: 'Export images',
            maxFiles: 1,
            convert: async (files, options) => {
                const blob = await pdfToImagesZip(files[0], options.baseName, options.progress);
                return {
                    blob,
                    filename: `${options.baseName}-pages.zip`,
                    summary: 'Each PDF page was exported as a PNG image and bundled into a ZIP file.'
                };
            }
        },
        'images-to-pdf': {
            name: 'Images to PDF',
            outputExtension: 'pdf',
            outputLabel: 'PDF',
            buttonText: 'Create PDF',
            maxFiles: 0,
            convert: async (files, options) => {
                const blob = await imagesToPdf(files, options.progress);
                return {
                    blob,
                    filename: `${options.baseName}-images.pdf`,
                    summary: `${files.length} image${files.length === 1 ? '' : 's'} were added to one PDF.`
                };
            }
        }
    };

    function requireGlobal(name, label) {
        if (!window[name]) {
            throw new Error(`${label} library failed to load. Check your connection and refresh the page.`);
        }
        return window[name];
    }

    async function extractPdfTextBlocks(file) {
        const pdfjsLib = requireGlobal('pdfjsLib', 'PDF rendering');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const blocks = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const items = textContent.items || [];
            const lines = [];
            let currentLine = '';
            let lastY = null;
            let lastScale = 1;

            items.forEach((item) => {
                const y = item.transform && typeof item.transform[5] === 'number' ? item.transform[5] : 0;
                const scale = item.transform && typeof item.transform[0] === 'number' && item.transform[0] > 0 ? item.transform[0] : 1;

                if (lastY !== null && Math.abs(y - lastY) > 3) {
                    if (currentLine.trim()) lines.push({ text: currentLine.trim(), scale: lastScale });
                    currentLine = '';
                }

                if (currentLine.trim()) currentLine += ' ';

                const str = typeof item.str === 'string' ? item.str : '';
                currentLine += str;
                lastScale = Math.max(lastScale || 1, scale);
                lastY = y;
            });

            if (currentLine.trim()) lines.push({ text: currentLine.trim(), scale: lastScale || 1 });

            let images = [];
            try {
                const ops = await page.getOperatorList();
                for (let i = 0; i < ops.fnArray.length; i++) {
                    if ([pdfjsLib.OPS.paintImageXObject, pdfjsLib.OPS.paintJpegXObject, pdfjsLib.OPS.paintImageXObjectRepeat, pdfjsLib.OPS.paintJpegXObjectRepeat].includes(ops.fnArray[i])) {
                        const imageId = ops.argsArray[i][0];
                        try {
                            const image = await page.objs.get(imageId);
                            if (image && image.data) images.push(image);
                        } catch (e) {
                            // ignore unresolved inline image
                        }
                    }
                }
            } catch (e) {
                // ignore image extraction failures
            }

            blocks.push({ page: pageNumber, lines: lines.filter((line) => line.text), images });
        }

        return blocks;
    }

    async function extractPdfText(file) {
        const blocks = await extractPdfTextBlocks(file);
        return {
            blocks,
            text: blocks.map((block) => block.lines.map((l) => l.text).join('\n')).join('\n\n')
        };
    }

async function createDocxFromText(result) {
        const JSZip = requireGlobal('JSZip', 'ZIP creation');
        const zip = new JSZip();

        const pages = [];
        const imageRels = [];

        const blocks = result && result.blocks ? result.blocks : [];

        for (let pageIndex = 0; pageIndex < blocks.length; pageIndex += 1) {
            const block = blocks[pageIndex];
            const pageMedia = [];
            const pageImageRels = [];
            const images = block && block.images ? block.images : [];

            for (let imageIndex = 0; imageIndex < images.length; imageIndex += 1) {
                const image = images[imageIndex];
                const blob = await imageToPngBlob(image);
                if (!blob) continue;
                const elementId = `img-${pageIndex}-${imageIndex}`;
                const relId = `${elementId}-rId`;
                const path = `media/${elementId}.${blob.type === 'image/jpeg' ? 'jpeg' : 'png'}`;
                zip.file(`word/${path}`, blob);
                pageMedia.push({ elementId, relId, path, width: image.width || 0, height: image.height || 0 });
                pageImageRels.push({ relId, path, elementId });
            }

            const paragraphs = [];
            const lines = block && block.lines ? block.lines : [];
            lines.forEach((line) => {
                const lineText = typeof line === 'string' ? line : (line.text || '');
                if (!lineText) return;
                const scale = typeof line.scale === 'number' && line.scale > 0 ? line.scale : 1;
                const fontSize = Math.max(8, Math.min(72, Math.round(scale > 1 ? scale * 10 : 22)));
                const isHeading = scale > 1.45;
                const headingLevel = isHeading ? Math.min(6, Math.max(1, Math.round(scale + 2))) : 0;

                paragraphs.push({
                    type: isHeading ? 'heading' : 'paragraph',
                    level: headingLevel,
                    text: escapeXml(lineText),
                    lines: [{
                        text: escapeXml(lineText),
                        bold: scale > 1.15 || isHeading,
                        size: fontSize
                    }]
                });
            });

            pages.push({ pageNumber: block ? block.page : 1, paragraphs, media: pageMedia, rels: pageImageRels });
            imageRels.push(...pageImageRels);
        }

        zip.file('[Content_Types].xml', buildContentTypes(imageRels));
        zip.folder('_rels').file('.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n</Relationships>`);
        zip.folder('word').folder('_rels').file('document.xml.rels', buildDocumentRels(imageRels));
        zip.folder('word').file('document.xml', buildRichDocumentXml(pages));

        const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
        return new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }

    async function imageToPngBlob(image) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, image.width || 1);
            canvas.height = Math.max(1, image.height || 1);
            const ctx = canvas.getContext('2d');
            if (!image.data) return null;
            const imgData = ctx.createImageData(canvas.width, canvas.height);
            const src = image.data;
            let k = 0;
            for (let i = 0; i < imgData.data.length && k < src.length; i += 4) {
                imgData.data[i] = src[k++];
                imgData.data[i + 1] = src[k++];
                imgData.data[i + 2] = src[k++];
                imgData.data[i + 3] = src[k++];
            }
            ctx.putImageData(imgData, 0, 0);
            return new Promise((resolve) => {
                canvas.toBlob((blob) => resolve(blob), 'image/png');
            });
        } catch (e) {
            return null;
        }
    }

    function buildContentTypes(imageRels) {
        const overrides = [{ partName: '/word/document.xml', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml' }];
        const defaults = [
            { ext: 'rels', contentType: 'application/vnd.openxmlformats-package.relationships+xml' },
            { ext: 'xml', contentType: 'application/xml' }
        ];

        const seen = new Set();
        (imageRels || []).forEach((rel) => {
            if (!rel || !rel.path || seen.has(rel.path)) return;
            seen.add(rel.path);
            const ext = rel.path.split('.').pop();
            const map = { png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg' };
            if (map[ext]) overrides.push({ partName: `/word/${rel.path}`, contentType: map[ext] });
            else defaults.push({ ext, contentType: 'application/octet-stream' });
        });

        const rows = [`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`, `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`];
        defaults.forEach((d) => rows.push(`  <Default Extension="${d.ext}" ContentType="${d.contentType}"/>`));
        overrides.forEach((o) => rows.push(`  <Override PartName="${o.partName}" ContentType="${o.contentType}"/>`));
        rows.push(`</Types>`);
        return rows.join('\n');
    }

    function buildDocumentRels(imageRels) {
        const rows = [`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`, `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`];
        (imageRels || []).forEach((rel) => {
            if (!rel) return;
            rows.push(`  <Relationship Id="${rel.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${rel.path}"/>`);
        });
        rows.push(`</Relationships>`);
        return rows.join('\n');
    }

    function buildRichDocumentXml(pages) {
        const sections = [];

        (pages || []).forEach((page) => {
            if (!page) return;
            (page.paragraphs || []).forEach((paragraph) => {
                if (!paragraph) return;
                if (paragraph.type === 'heading') {
                    sections.push(headingParagraphXml(paragraph.level || 1, paragraph.text || ''));
                } else if (paragraph.lines && paragraph.lines.length) {
                    sections.push(paragraphLinesXml(paragraph.lines));
                }
            });

            (page.media || []).forEach((media) => sections.push(imageXml(media)));
        });

        if (sections.length === 0) {
            sections.push(paragraphLinesXml([{ text: 'No text could be extracted.', size: 22, bold: false }]));
        }

        const body = sections.join('');
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body>
</w:document>`;
    }

    function headingParagraphXml(level, text) {
        if (!text) text = 'Untitled';
        const size = Math.max(1, Math.min(level, 6));
        const spacing = Math.max(160, 40 * (7 - size));
        const fontSize = Math.max(16, 32 - (size - 1) * 3);
        return `<w:p>
  <w:pPr>
    <w:pStyle w:val="Heading${size}"/>
    <w:spacing w:after="${spacing}" w:line="280" w:lineRule="auto"/>
    <w:rPr><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="${fontSize * 2}"/></w:rPr>
  </w:pPr>
  <w:r><w:rPr><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="${fontSize * 2}"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>
</w:p>`;
    }

    function paragraphLinesXml(lines) {
        const runs = lines.map((line) => {
            const size = typeof line.size === 'number' && line.size > 0 ? Math.max(8, Math.min(72, Math.round(line.size))) : 22;
            const boldAttr = line.bold ? '<w:b/><w:bCs/>' : '';
            return `<w:r><w:rPr>${boldAttr}<w:color w:val="222222"/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(line.text || '')}</w:t></w:r>`;
        }).join('');

        return `<w:p><w:pPr><w:spacing w:after="160" w:line="280" w:lineRule="auto"/></w:pPr>${runs || '<w:r><w:t></w:t></w:r>'}</w:p>`;
    }

    function imageXml(media) {
        if (!media) return '';
        const width = Math.max(1, media.width || 1);
        const height = Math.max(1, media.height || 1);
        const emuWidth = Math.round(width * 9525);
        const emuHeight = Math.round(height * 9525);
        return `<w:p>
  <w:r>
    <w:drawing>
      <wp:inline xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\">
        <wp:extent cx=\"${emuWidth}\" cy=\"${emuHeight}\"/>
        <wp:docPr id=\"${media.elementId}\" name=\"${media.elementId}\"/>
        <a:graphic xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\">
          <a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\">
            <pic:pic xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\">
              <pic:nvPicPr>
                <pic:cNvPr id=\"0\" name=\"${media.elementId}\"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed=\"${media.relId}\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr><a:prstGeom prst=\"rect\"/></pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>`;
    }

    async function extractDocxText(file) {
        const JSZip = requireGlobal('JSZip', 'ZIP extraction');
        const zip = await JSZip.loadAsync(file);
        const documentXml = zip.file('word/document.xml');

        if (!documentXml) throw new Error('This does not look like a valid .docx file.');

        const xml = await documentXml.async('string');
        const paragraphs = [];
        const regex = /<w:p\b[\s\S]*?<\/w:p>/gi;

        let match = regex.exec(xml);
        while (match) {
            const pieces = [];
            match[0].replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:br\s*\/?>/gi, (item, text) => {
                if (text !== undefined) pieces.push(decodeXml(text));
                else pieces.push('\n');
                return item;
            });
            const text = pieces.join('').replace(/[ \t]+/g, ' ').trim();
            if (text) paragraphs.push(text);
            match = regex.exec(xml);
        }

        return paragraphs.join('\n\n');
    }

    async function createPdfFromText(text) {
        const PDFLib = requireGlobal('PDFLib', 'PDF generation');
        const pdfDoc = await PDFLib.PDFDocument.create();
        const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        const fontSize = 11;
        const lineHeight = 14;
        const margin = 56;
        const pageSize = [595.28, 841.89];
        const paragraphs = String(text).split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);

        let page = pdfDoc.addPage(pageSize);
        let y = pageSize[1] - margin;

        const addPageIfNeeded = () => {
            if (y < margin) {
                page = pdfDoc.addPage(pageSize);
                y = pageSize[1] - margin;
            }
        };

        paragraphs.forEach((paragraph) => {
            const lines = wrapText(paragraph, font, fontSize, pageSize[0] - margin * 2);
            lines.forEach((line) => {
                addPageIfNeeded();
                page.drawText(line, { x: margin, y, size: fontSize, font });
                y -= lineHeight;
            });
            y -= 8;
        });

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    }

    function wrapText(text, font, fontSize, maxWidth) {
        const words = text.split(/\s+/).filter(Boolean);
        const lines = [];
        let currentLine = '';

        words.forEach((word) => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (font.widthOfTextAtSize(testLine, fontSize) <= maxWidth) currentLine = testLine;
            else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        });

        if (currentLine) lines.push(currentLine);
        return lines.length ? lines : [''];
    }

    async function pdfToImagesZip(file, baseName, progress) {
        const pdfjsLib = requireGlobal('pdfjsLib', 'PDF rendering');
        const JSZip = requireGlobal('JSZip', 'ZIP creation');
        const scale = parseFloat(document.getElementById('scaleSelect')?.value || '1.5');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const zip = new JSZip();

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            if (progress) progress(`Rendering page ${pageNumber} of ${pdf.numPages}...`);
            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            const context = canvas.getContext('2d');

            if (!context) throw new Error('Canvas is not available in this browser.');

            await page.render({ canvasContext: context, viewport }).promise;
            const blob = await canvasToBlob(canvas, 'image/png');
            zip.file(`${safeFileName(baseName)}-page-${String(pageNumber).padStart(2, '0')}.png`, blob);
        }

        if (progress) progress('Zipping images...');
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }, (metadata) => {
            if (progress && metadata.percent) progress(`Zipping ${Math.round(metadata.percent)}%...`);
        });

        return new Blob([zipBlob], { type: 'application/zip' });
    }

    async function imagesToPdf(files, progress) {
        const PDFLib = requireGlobal('PDFLib', 'PDF generation');
        const pdfDoc = await PDFLib.PDFDocument.create();
        const pageSize = [595.28, 841.89];

        for (let index = 0; index < files.length; index += 1) {
            if (progress) progress(`Adding image ${index + 1} of ${files.length}...`);
            const jpegBlob = await imageFileToJpegBlob(files[index]);
            const imageBytes = await jpegBlob.arrayBuffer();
            const image = await pdfDoc.embedJpg(imageBytes);
            const page = pdfDoc.addPage(pageSize);
            const pageWidth = pageSize[0];
            const pageHeight = pageSize[1];
            const margin = 36;
            const scale = Math.min((pageWidth - margin * 2) / image.width, (pageHeight - margin * 2) / image.height);
            const width = image.width * scale;
            const height = image.height * scale;
            const x = (pageWidth - width) / 2;
            const y = (pageHeight - height) / 2;
            page.drawImage(image, { x, y, width, height });
        }

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    }

    function imageFileToJpegBlob(file) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            const objectUrl = URL.createObjectURL(file);

            image.onload = () => {
                URL.revokeObjectURL(objectUrl);
                const maxDimension = 1800;
                const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                const context = canvas.getContext('2d');

                if (!context) {
                    reject(new Error('Failed to prepare image for PDF.'));
                    return;
                }

                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Failed to prepare image for PDF.'));
                }, 'image/jpeg', 0.9);
            };

            image.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Failed to load image.'));
            };

            image.src = objectUrl;
        });
    }

    function canvasToBlob(canvas, type) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to render canvas output.'));
            }, type);
        });
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function setButtonLoading(button, loading, loadingText) {
        if (!button) return;
        button.disabled = loading;
        if (loading) {
            button.dataset.originalText = button.textContent;
            button.innerHTML = `
                <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                ${loadingText}
            `;
        } else if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    function getBaseName(filename) {
        return safeFileName(String(filename || 'document').replace(/\.[^/.]+$/, '')) || 'document';
    }

    function getDefaultFilename(filename, extension) {
        return `${getBaseName(filename)}-converted.${extension}`;
    }

    function safeFileName(value) {
        return String(value || 'document').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'document';
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeXml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function decodeXml(value) {
        return String(value)
            .replace(/&apos;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/>/g, '>')
            .replace(/&lt;/g, '<')
            .replace(/&amp;/g, '&');
    }

    function createExcelFromPdfText(blocks) {
        const XLSX = requireGlobal('XLSX', 'Spreadsheet generation');
        const rows = [['Page', 'Text']];

        (blocks || []).forEach((block) => {
            const lines = block.lines || [];
            if (!lines.length) {
                rows.push([block.page, '']);
                return;
            }

            lines.forEach((line) => {
                const text = typeof line === 'string' ? line : (line.text || '');
                rows.push([block.page, text]);
            });
        });

        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        worksheet['!cols'] = [
            { wch: 10 },
            { wch: 100 }
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'PDF Text');
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });
        const buf = new ArrayBuffer(wbout.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < wbout.length; i++) {
            view[i] = wbout.charCodeAt(i) & 0xFF;
        }
        return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function hexToRgb(hex) {
        const normalized = String(hex || '#111111').replace('#', '');
        const value = normalized.length === 3
            ? normalized.split('').map((char) => char + char).join('')
            : normalized;
        const number = parseInt(value, 16);
        return {
            r: ((number >> 16) & 255) / 255,
            g: ((number >> 8) & 255) / 255,
            b: (number & 255) / 255
        };
    }

    window.DownloadDocToolkit = {
        initDarkMode,
        initUniversalToolPage
    };
})();

window.DownloadDocToolkit.initDarkMode();
window.DownloadDocToolkit.initUniversalToolPage();
