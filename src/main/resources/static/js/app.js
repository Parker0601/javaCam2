document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const captureBtn = document.getElementById('capture-btn');
    const retakeBtn = document.getElementById('retake-btn');
    const photoPreview = document.getElementById('photo-preview');
    const resultContainer = document.getElementById('result-container');
    const qrCode = document.getElementById('qr-code');
    const frameOptions = document.querySelectorAll('.frame-option');
    const framePreview = document.getElementById('frame-preview');
    
    let selectedFrame = null;
    let stream = null;

    // 初始化相機
    async function initCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            video.srcObject = stream;
            // 添加鏡像反轉樣式
            video.style.transform = 'scaleX(-1)';
            
            // 等待視頻加載完成
            video.onloadedmetadata = () => {
                console.log('Video loaded successfully');
                // 動態設定 camera-container 和 photo-preview 的 aspect-ratio
                const ratio = video.videoWidth / video.videoHeight;
                document.querySelectorAll('.camera-container, #photo-preview').forEach(el => {
                    el.style.aspectRatio = ratio;
                });
            };
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('無法訪問相機，請確保已授予相機權限。');
        }
    }

    // 更新相框預覽
    function updateFramePreview(frameName) {
        console.log('Updating frame preview with:', frameName);
        if (frameName) {
            const frameImg = new Image();
            frameImg.src = `/images/frames/${frameName}.png`;
            frameImg.onload = () => {
                framePreview.innerHTML = '';
                framePreview.appendChild(frameImg);
                console.log('Frame preview updated');
            };
            frameImg.onerror = () => {
                console.error('Error loading frame image:', frameName);
            };
        } else {
            framePreview.innerHTML = '';
        }
    }

    // 拍照
    function capturePhoto() {
        console.log('Capturing photo...');
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // object-fit: cover 計算 for video
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = canvas.width / canvas.height;
        let vDrawWidth, vDrawHeight, vOffsetX, vOffsetY;
        if (videoAspect > canvasAspect) {
            // video 比較寬，左右裁切
            vDrawHeight = canvas.height;
            vDrawWidth = video.videoWidth * (canvas.height / video.videoHeight);
            vOffsetX = (canvas.width - vDrawWidth) / 2;
            vOffsetY = 0;
        } else {
            // video 比較高，上下裁切
            vDrawWidth = canvas.width;
            vDrawHeight = video.videoHeight * (canvas.width / video.videoWidth);
            vOffsetX = 0;
            vOffsetY = (canvas.height - vDrawHeight) / 2;
        }

        // 鏡像翻轉
        context.save();
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, vOffsetX, vOffsetY, vDrawWidth, vDrawHeight);
        context.restore();

        // 疊加相框（object-fit: cover）
        if (selectedFrame) {
            const frameImg = new Image();
            frameImg.src = `/images/frames/${selectedFrame}.png`;
            frameImg.onload = () => {
                const frameAspect = frameImg.width / frameImg.height;
                let drawWidth, drawHeight, offsetX, offsetY;
                if (frameAspect > canvasAspect) {
                    drawHeight = canvas.height;
                    drawWidth = frameImg.width * (canvas.height / frameImg.height);
                    offsetX = (canvas.width - drawWidth) / 2;
                    offsetY = 0;
                } else {
                    drawWidth = canvas.width;
                    drawHeight = frameImg.height * (canvas.width / frameImg.width);
                    offsetX = 0;
                    offsetY = (canvas.height - drawHeight) / 2;
                }
                context.drawImage(frameImg, offsetX, offsetY, drawWidth, drawHeight);
                uploadPhoto();
            };
            frameImg.onerror = uploadPhoto;
        } else {
            uploadPhoto();
        }
    }

    // 上傳照片
    async function uploadPhoto() {
        console.log('Uploading photo...');
        const photoData = canvas.toDataURL('image/jpeg');
        const blob = await (await fetch(photoData)).blob();
        const formData = new FormData();
        formData.append('photo', blob, 'photo.jpg');

        try {
            const response = await fetch('/api/photos/upload', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                displayResult(data);
            } else {
                throw new Error('Upload failed');
            }
        } catch (err) {
            console.error('Error uploading photo:', err);
            alert('上傳照片時發生錯誤，請重試。');
        }
    }

    // 顯示結果
    function displayResult(data) {
        framePreview.style.display = 'none';
        video.style.display = 'none'; // 拍照後隱藏鏡頭
        console.log('photoBase64:', data.photoBase64 ? data.photoBase64.substring(0, 100) : 'EMPTY');
        if (!data.photoBase64) {
            photoPreview.innerHTML = '<div style="color:red;">照片資料為空，請檢查後端API回傳！</div>';
            photoPreview.style.display = 'block';
            return;
        }
        photoPreview.innerHTML = `<img src=\"data:image/jpeg;base64,${data.photoBase64}\" alt=\"Captured photo\">`;
        photoPreview.style.display = 'block';
        qrCode.innerHTML = '';
        resultContainer.style.display = 'none';
        document.querySelector('.frame-selection').style.display = 'none';
        captureBtn.style.display = 'none';
        retakeBtn.style.display = 'inline-block';
    }

    // 重拍
    function retake() {
        photoPreview.innerHTML = '';
        photoPreview.style.display = 'none';
        resultContainer.style.display = 'none';
        captureBtn.style.display = 'inline-block';
        retakeBtn.style.display = 'none';
        framePreview.style.display = 'block';
        document.querySelector('.frame-selection').style.display = 'block';
        video.style.display = 'block'; // 重拍時顯示鏡頭
    }

    // 選擇相框
    frameOptions.forEach(option => {
        option.addEventListener('click', () => {
            frameOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedFrame = option.dataset.frame;
            updateFramePreview(selectedFrame);
        });
    });

    // 事件監聽器
    captureBtn.addEventListener('click', capturePhoto);
    retakeBtn.addEventListener('click', retake);

    // 初始化相機
    initCamera();
}); 