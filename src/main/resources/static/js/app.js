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

            const data = await response.json(); // 先嘗試解析 JSON，包含照片數據

            if (response.ok) {
                // 如果狀態碼是 2xx，表示成功
                displayResult(data);
            } else {
                // 如果狀態碼不是 2xx，表示後端有錯誤
                console.error('Upload failed with status:', response.status, data);
                // 顯示照片（因為後端回傳了），同時提示後端有錯誤
                displayResult(data); // 即使有錯，仍顯示後端回傳的照片和數據
                alert(`上傳處理完成，但伺服器回報錯誤 (${response.status}): ${data.message || JSON.stringify(data)}`);
            }
        } catch (err) {
            // 真正的網路錯誤或 JSON 解析錯誤
            console.error('Error during upload or processing response:', err);
            alert('上傳照片時發生連線或資料處理錯誤，請檢查伺服器。');
        }
    }

    // 顯示結果
    function displayResult(data) {
        // 相框預覽在拍照後可以保留在鏡頭上，或者隱藏
        // 如果你想讓即時預覽一直顯示，這裡可以不隱藏 framePreview
        // framePreview.style.display = 'none'; // 如果不想保留即時相框，就取消這行註解

        // 視訊鏡頭保持顯示
        video.style.display = 'block';

        console.log('photoBase64:', data.photoBase64 ? data.photoBase64.substring(0, 100) : 'EMPTY');
        if (!data.photoBase64) {
            photoPreview.innerHTML = '<div style="color:red;">照片資料為空，請檢查後端API回傳！</div>';
            photoPreview.style.display = 'block'; // 確保 photoPreview 區塊本身可見
            // 錯誤時，按鈕和相框選擇恢復到初始狀態 (或維持拍照後的狀態，這裡選擇恢復初始)
            captureBtn.style.display = 'inline-block';
            retakeBtn.style.display = 'none';
            document.querySelector('.frame-selection').style.display = 'block';
            return;
        }

        // 顯示照片預覽
        photoPreview.innerHTML = `<img src="data:image/jpeg;base64,${data.photoBase64}" alt="Captured photo">`;
        photoPreview.style.display = 'block'; // 確保 photoPreview 區塊本身可見

        // 隱藏 QR Code (如果不需要顯示)
        qrCode.innerHTML = '';
        resultContainer.style.display = 'none';

        // 隱藏相框選擇區 (如果只需要在預覽時選擇)
        document.querySelector('.frame-selection').style.display = 'none';

        // 切換按鈕：顯示重拍，隱藏拍照
        captureBtn.style.display = 'none';
        retakeBtn.style.display = 'inline-block';
    }

    // 重拍
    function retake() {
        // 清空並隱藏照片預覽
        photoPreview.innerHTML = '';
        photoPreview.style.display = 'none';

        // 相框預覽與視訊鏡頭保持顯示
        framePreview.style.display = 'block'; // 確保相框預覽可見
        video.style.display = 'block'; // 確保視訊鏡頭可見

        // 隱藏結果容器 (如果它還顯示著 QR Code 之類的)
        resultContainer.style.display = 'none';

        // 切換按鈕：顯示拍照，隱藏重拍
        captureBtn.style.display = 'inline-block';
        retakeBtn.style.display = 'none';

        // 顯示相框選擇區
        document.querySelector('.frame-selection').style.display = 'block';
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