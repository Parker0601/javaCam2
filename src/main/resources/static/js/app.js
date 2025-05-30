document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const captureBtn = document.getElementById('capture-btn');
    const retakeBtn = document.getElementById('retake-btn');
    const photoPreview = document.getElementById('photo-preview');
    const downloadBtn = document.getElementById('download-btn');
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

        // object-fit: cover 計算 for video 和相框/人物
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = canvas.width / canvas.height;

        // 繪製 Video (最底層)
        const vDrawPos = calculateObjectFitCoverDrawPos(video.videoWidth, video.videoHeight, canvas.width, canvas.height);
        context.save();
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, vDrawPos.x, vDrawPos.y, vDrawPos.width, vDrawPos.height);
        context.restore();

        // 繪製背景人物 (中間層)
        const characterImg = new Image();
        characterImg.src = '/images/frames/background-character.png';
        characterImg.onload = () => {
            const cssCharWidth = 210;
            const cssCharHeight = 280;
            const cssBottomOffset = 0;
            const cssRightOffset = 200;

            const container = document.querySelector('.camera-container');
            if (!container || container.offsetWidth === 0 || container.offsetHeight === 0) {
                 console.error('Camera container has no dimensions, cannot draw character correctly.');
                 drawFrame(); // 跳過人物，直接繪製相框
                 return;
            }
            const containerWidth = container.offsetWidth;
            const containerHeight = container.offsetHeight;
            const scaleX = canvas.width / containerWidth;
            const scaleY = canvas.height / containerHeight;

            const drawCharWidth = cssCharWidth * scaleX;
            const drawCharHeight = cssCharHeight * scaleY;
            const drawCharX = canvas.width - drawCharWidth - cssRightOffset * scaleX;
            const drawCharY = canvas.height - drawCharHeight - cssBottomOffset * scaleY;

            context.drawImage(characterImg, drawCharX, drawCharY, drawCharWidth, drawCharHeight);
            drawFrame(); // 繪製完人物後繪製相框
        };
        characterImg.onerror = () => {
             console.error('Error loading character image for capture.');
             drawFrame(); // 如果人物圖加載失敗，仍然繪製相框
        };

        //  helper 函數，計算 object-fit: cover 的繪製位置和大小
        function calculateObjectFitCoverDrawPos(imgWidth, imgHeight, targetWidth, targetHeight) {
             const imgAspect = imgWidth / imgHeight;
             const targetAspect = targetWidth / targetHeight;
             let drawWidth, drawHeight, offsetX, offsetY;
             if (imgAspect > targetAspect) {
                 drawHeight = targetHeight;
                 drawWidth = imgWidth * (targetHeight / imgHeight);
                 offsetX = (targetWidth - drawWidth) / 2;
                 offsetY = 0;
             } else {
                 drawWidth = targetWidth;
                 drawHeight = imgHeight * (targetWidth / imgWidth);
                 offsetX = 0;
                 offsetY = (targetHeight - drawHeight) / 2;
             }
             return { x: offsetX, y: offsetY, width: drawWidth, height: drawHeight };
        }

        // 繪製相框 (最上層)
        function drawFrame() {
            if (selectedFrame) {
                const frameImg = new Image();
                frameImg.src = `/images/frames/${selectedFrame}.png`;
                frameImg.onload = () => {
                     const frameDrawPos = calculateObjectFitCoverDrawPos(frameImg.width, frameImg.height, canvas.width, canvas.height);
                     context.drawImage(frameImg, frameDrawPos.x, frameDrawPos.y, frameDrawPos.width, frameDrawPos.height);
                     uploadPhoto(); // 最後繪製完相框再上傳
                };
                frameImg.onerror = uploadPhoto; // 如果相框加載失敗，直接上傳 (不包含相框)
            } else {
                 uploadPhoto(); // 沒有選相框，直接上傳 video 和人物
            }
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
                // 如果狀態碼是 2xx，表示成功，解析 JSON 並顯示結果
                const data = await response.json();
                displayResult(data);
                console.log('Photo uploaded and processed successfully.');
            } else {
                // 如果狀態碼不是 2xx，表示後端有錯誤，嘗試讀取錯誤訊息
                let errorDetails = `伺服器回報錯誤 (${response.status})`;
                let data = {}; // 初始化 data 物件

                try {
                    // 嘗試解析 JSON，看後端是否有回傳錯誤細節或照片數據
                    data = await response.json();
                    errorDetails += `: ${data.message || JSON.stringify(data)}`;
                } catch (jsonErr) {
                    // 如果解析 JSON 失敗 (後端回傳非 JSON)，嘗試讀取文本
                    console.warn('Failed to parse error response as JSON, trying text:', jsonErr);
                    try {
                         const textBody = await response.text();
                         errorDetails += `: ${textBody}`;
                    } catch (textErr) {
                         console.error('Failed to read error response as text:', textErr);
                         errorDetails += `: (無法讀取回應內容)`;
                    }
                }

                console.error('Upload failed:', response.status, data || errorDetails);
                // 即使後端回報錯誤，如果回應中有照片數據，仍然顯示
                if (data && data.photoBase64) {
                     displayResult(data); // 顯示後端回傳的照片
                     alert(`上傳處理完成，但${errorDetails}`);
                } else {
                     // 如果沒有照片數據，只顯示錯誤訊息
                     alert(`上傳照片失敗：${errorDetails}`);
                }
            }
        } catch (err) {
            // 真正的網路連線錯誤 (例如伺服器無回應)
            console.error('Error during network request or response processing:', err);
            alert('上傳照片時發生網路連線或資料處理錯誤，請檢查伺服器是否運行及網路狀態。');
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
            downloadBtn.style.display = 'none';
            document.querySelector('.frame-selection').style.display = 'block';
            return;
        }

        // 顯示照片預覽
        photoPreview.innerHTML = `<img src="data:image/jpeg;base64,${data.photoBase64}" alt="Captured photo">`;
        photoPreview.style.display = 'block'; // 確保 photoPreview 區塊本身可見

        // 隱藏相框選擇區 (如果只需要在預覽時選擇)
        document.querySelector('.frame-selection').style.display = 'none';

        // 切換按鈕：顯示重拍和下載，隱藏拍照
        captureBtn.style.display = 'none';
        retakeBtn.style.display = 'inline-block';
        downloadBtn.style.display = 'inline-block'; // 顯示下載按鈕
    }

    // 重拍
    function retake() {
        // 清空並隱藏照片預覽
        photoPreview.innerHTML = '';
        photoPreview.style.display = 'none';

        // 相框預覽與視訊鏡頭保持顯示
        framePreview.style.display = 'block'; // 確保相框預覽可見
        video.style.display = 'block'; // 確保視訊鏡頭可見

        // 切換按鈕：顯示拍照，隱藏重拍和下載
        captureBtn.style.display = 'inline-block';
        retakeBtn.style.display = 'none';
        downloadBtn.style.display = 'none'; // 隱藏下載按鈕

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

    // 下載按鈕點擊事件
    downloadBtn.addEventListener('click', () => {
        const img = photoPreview.querySelector('img');
        if (img) {
            const link = document.createElement('a');
            link.href = img.src; // 使用 img 的 src (Base64 資料)
            link.download = 'photobooth_photo.jpg'; // 指定下載檔案名稱
            link.click(); // 模擬點擊下載連結
        } else {
            alert('沒有照片可以下載！');
        }
    });

    // 初始化相機
    initCamera();
}); 