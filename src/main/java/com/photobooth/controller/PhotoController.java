package com.photobooth.controller;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.UUID;

@RestController
@RequestMapping("/api/photos")
@CrossOrigin(origins = "*")
public class PhotoController {

    @PostMapping("/upload")
    public ResponseEntity<?> uploadPhoto(@RequestParam("photo") MultipartFile photo) {
        try {
            // 生成唯一的文件名
            String fileName = UUID.randomUUID().toString() + ".jpg";
            
            // 將照片轉換為 Base64
            String base64Image = Base64.getEncoder().encodeToString(photo.getBytes());
            
            // 生成 QR Code
            String downloadUrl = "http://localhost:8080/api/photos/download/" + fileName;
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(downloadUrl, BarcodeFormat.QR_CODE, 200, 200);
            
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", outputStream);
            String qrCodeBase64 = Base64.getEncoder().encodeToString(outputStream.toByteArray());
            
            // 返回照片和 QR Code
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new PhotoResponse(base64Image, qrCodeBase64, downloadUrl));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error processing photo: " + e.getMessage());
        }
    }
    
    @GetMapping("/download/{fileName}")
    public ResponseEntity<?> downloadPhoto(@PathVariable String fileName) {
        // TODO: 實現照片下載邏輯
        return ResponseEntity.ok().build();
    }
    
    private static class PhotoResponse {
        private final String photoBase64;
        private final String qrCodeBase64;
        private final String downloadUrl;
        
        public PhotoResponse(String photoBase64, String qrCodeBase64, String downloadUrl) {
            this.photoBase64 = photoBase64;
            this.qrCodeBase64 = qrCodeBase64;
            this.downloadUrl = downloadUrl;
        }
        
        // Getters
        public String getPhotoBase64() { return photoBase64; }
        public String getQrCodeBase64() { return qrCodeBase64; }
        public String getDownloadUrl() { return downloadUrl; }
    }
} 