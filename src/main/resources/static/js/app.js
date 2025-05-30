document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const captureBtn = document.getElementById('capture-btn');
    const retakeBtn = document.getElementById('retake-btn');
    const photoPreview = document.getElementById('photo-preview');
    const resultContainer = document.getElementById('result-container');
    const qrCode = document.getElementById('qr-code');
    const frameOptions = document.querySelectorAll('.frame-option');
    
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
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('無法訪問相機，請確保已授予相機權限。');
        }
    }

    // 拍照
    function capturePhoto() {
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // 保存當前變換狀態
        context.save();
        // 水平翻轉畫布
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        
        // 繪製視頻幀到 canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 恢復變換狀態
        context.restore();
        
        // 如果選擇了相框，添加相框
        if (selectedFrame) {
            const frameImg = new Image();
            frameImg.src = `/images/frames/${selectedFrame}.png`;
            frameImg.onload = () => {
                context.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
                uploadPhoto();
            };
        } else {
            uploadPhoto();
        }
    }

    // 上傳照片
    async function uploadPhoto() {
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
        // 顯示照片預覽
        photoPreview.innerHTML = `<img src="data:image/jpeg;base64,${data.photoBase64}" alt="Captured photo">`;
        
        // 顯示 QR Code
        qrCode.innerHTML = `<img src="data:image/png;base64,${data.qrCodeBase64}" alt="QR Code">`;
        
        // 顯示結果容器
        resultContainer.style.display = 'block';
        
        // 切換按鈕
        captureBtn.style.display = 'none';
        retakeBtn.style.display = 'inline-block';
    }

    // 重拍
    function retake() {
        photoPreview.innerHTML = '';
        resultContainer.style.display = 'none';
        captureBtn.style.display = 'inline-block';
        retakeBtn.style.display = 'none';
    }

    // 選擇相框
    frameOptions.forEach(option => {
        option.addEventListener('click', () => {
            frameOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedFrame = option.dataset.frame;
        });
    });

    // 事件監聽器
    captureBtn.addEventListener('click', capturePhoto);
    retakeBtn.addEventListener('click', retake);

    // 初始化相機
    initCamera();
}); 