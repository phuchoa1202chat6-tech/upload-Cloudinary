```markdown
# upload-cloudinary

Simple Node.js + Express server to upload and manage files on Cloudinary.

## Yêu cầu
- Node.js 18+ (khuyến nghị)
- Tài khoản Cloudinary và các biến môi trường cấu hình (không commit secret vào repo!)

## Cài đặt

1. Clone repo
2. Cài dependencies:
   ```bash
   npm install
   ```
3. Tạo file `.env` dựa trên `.env.example` và điền thông tin Cloudinary:
   - CLOUDINARY_CLOUD_NAME
   - CLOUDINARY_API_KEY
   - CLOUDINARY_API_SECRET
   - (tùy chọn) CLOUDINARY_FOLDER

4. Chạy server:
   - Phát triển (hot reload):
     ```bash
     npm run dev
     ```
   - Hoặc production:
     ```bash
     npm start
     ```

## Các endpoint

- GET /files
  - Lấy danh sách file trong folder (theo biến môi trường CLOUDINARY_FOLDER)
  - Hoặc truyền `?id=<public_id>` để lấy chi tiết một tài nguyên

- POST /upload
  - Body JSON: `{ "file": "<base64 data URL | remote URL | local path >", "folder": "optional" }`
  - Trả về object kết quả upload của Cloudinary

- PUT /files
  - Body JSON: `{ "id": "<public_id>", "newPublicId": "optional", "description": "optional" }`
  - `newPublicId` để đổi public_id, `description` để lưu vào context caption

- DELETE /files/:id
  - Xóa tài nguyên theo `public_id`

## Lưu ý bảo mật
- Không commit `.env` vào git. Sử dụng `.env.example` cho ví dụ cấu hình.
- Nếu deploy lên production, sử dụng secret manager hoặc biến môi trường của nền tảng (Heroku, Vercel, AWS, ...).

## Ví dụ nhanh (curl)

- Upload (ví dụ dùng remote URL):
```bash
curl -X POST http://localhost:3000/upload \
  -H "Content-Type: application/json" \
  -d '{"file":"https://example.com/image.jpg", "folder":"MyFolder"}'
```

- List:
```bash
curl http://localhost:3000/files
```

- Get one:
```bash
curl "http://localhost:3000/files?id=your_public_id_here"
```

- Update:
```bash
curl -X PUT http://localhost:3000/files \
  -H "Content-Type: application/json" \
  -d '{"id":"your_public_id_here", "description":"New caption"}'
```

- Delete:
```bash
curl -X DELETE http://localhost:3000/files/your_public_id_here
```
```
