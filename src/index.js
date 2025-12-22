import express from 'express';
import { v2 as cloudinary } from 'cloudinary';
import cors from 'cors';
import dotenv from 'dotenv';
import { Readable } from 'stream';
import OpenAI from 'openai';

dotenv.config();

const openai = new OpenAI({
  baseURL: 'https://ai.megallm.io/v1',
  apiKey: process.env.MEGA_CLOUD_NAME
});

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const FOLDER = process.env.CLOUDINARY_FOLDER || 'AI Slide';

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error('Missing Cloudinary configuration. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env');
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Route chào mừng
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Cloudinary API Server!' });
});

app.get('/files/all', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      resource_type: 'raw', // JSON files are 'raw' type, not 'upload'
      type: 'upload',
      prefix: 'AI Slide/', // Remove the /* wildcard
      max_results: 500
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lấy theo ID
app.get('/files/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await cloudinary.api.resource(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload JSON
app.post('/upload', async (req, res) => {
  const { file, public_id, folder } = req.body;
  if (!file) return res.status(400).json({ error: 'Thiếu dữ liệu JSON để upload.' });

  try {
    let jsonStr;
    if (typeof file === 'string') {
      if (file.startsWith('data:application/json;base64,')) {
        const base64 = file.split(',')[1];
        jsonStr = Buffer.from(base64, 'base64').toString('utf8');
      } else {
        jsonStr = file;
      }
    } else {
      jsonStr = JSON.stringify(file);
    }

    const buffer = Buffer.from(jsonStr, 'utf8');
    const stream = Readable.from(buffer);

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder || FOLDER,
          resource_type: 'raw',
          public_id: `${public_id || Date.now()}.json`,
          unique_filename: false
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.pipe(uploadStream);
    });

    res.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

const SYSTEM_PROMPT = `Bạn là một công cụ chuyển đổi nội dung bài học thành dữ liệu JSON cho Slide.

**NHIỆM VỤ:**
1.  Tiếp nhận văn bản dài từ người dùng.
2.  Chia văn bản thành các đoạn nhỏ, mỗi đoạn là một Slide.
3.  Tạo JSON Array chứa thông tin cho từng slide.

**QUY TẮC CỐT LÕI:**
*   **KHÔNG TÓM TẮT \`desc\`:** Trường \`desc\` phải chứa đầy đủ câu chữ của đoạn văn bản gốc tương ứng để người dùng đọc nguyên văn. Không được cắt bớt nội dung.
*   **PHONG CÁCH ẢNH ĐƠN GIẢN:** \`promptImage\` không được dùng style 4k/8k/chi tiết cao. Hãy mô tả ảnh phong cách đơn giản, dễ nhìn ở kích thước nhỏ (300px).
*   **OUTPUT:** Chỉ trả về chuỗi JSON (Raw JSON), không có markdown block, không có lời dẫn.

**CẤU TRÚC JSON (Array of Objects):**
[
  {
    "title": "String - Tiếng Việt: Tiêu đề ngắn gọn bao quát nội dung đoạn này (dưới 10 từ)",
    "desc": "String - Tiếng Việt: Nội dung văn bản GỐC của đoạn này (giữ nguyên văn để đọc)",
    "promptImage": "String - Tiếng Anh: Mô tả ảnh cho DiffusionPipeline."
  }
]

**HƯỚNG DẪN VIẾT PROMPT IMAGE:**
*   Viết bằng Tiếng Anh.
*   Phong cách: Simple flat illustration, vector art, minimalist, cartoon style, or simple icon style.
*   Tránh: Photorealistic, highly detailed, complex background, 4k, 8k.
*   Tập trung vào chủ thể chính rõ ràng trên nền đơn giản.

**VÍ DỤ:**
Input: "Xin chào các em. Hôm nay chúng ta tìm hiểu về loài Mèo. Mèo là động vật có vú nhỏ nhắn và ăn thịt, sống chung với loài người."

Output:
[
  {
    "title": "Giới thiệu về loài Mèo",
    "desc": "Xin chào các em. Hôm nay chúng ta tìm hiểu về loài Mèo. Mèo là động vật có vú nhỏ nhắn và ăn thịt, sống chung với loài người.",
    "promptImage": "cute cat sitting, simple flat illustration, vector style, white background, minimalist, soft colors, clear shapes"
  }
]`;

app.post('/convert-text-to-json', async (req, res) => {
  const { text, title } = req.body;
  console.log("text:", text);
  if (!text || !title) {
    return res.status(400).json({ error: 'Thiếu văn bản hoặc tiêu đề.' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'deepseek-ai/deepseek-v3.1-terminus',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text }
      ]
    });

    const aiResponse = response.choices[0].message.content.trim();
    let jsonArray;

    try {
      const jsonMatch = aiResponse.match(/```(?:json)?\n([\s\S]*?)\n```/);
      const cleanJson = jsonMatch ? jsonMatch[1] : aiResponse;
      jsonArray = JSON.parse(cleanJson);
    } catch (parseError) {
      return res.status(500).json({ error: 'Không thể parse JSON từ AI.' });
    }

    const jsonStr = JSON.stringify(jsonArray, null, 2);
    const buffer = Buffer.from(jsonStr, 'utf8');
    const stream = Readable.from(buffer);

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'AI Slide',
          resource_type: 'raw',
          public_id: `${title}.json`,
          unique_filename: false
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.pipe(uploadStream);
    });

    res.json({ message: 'Convert và upload thành công', result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cập nhật file (đổi tên hoặc mô tả)
app.put('/files', async (req, res) => {
  const { id, newPublicId, description } = req.body;
  if (!id) return res.status(400).json({ error: 'Thiếu ID tài nguyên.' });

  try {
    if (newPublicId) await cloudinary.uploader.rename(id, newPublicId);
    if (description !== undefined) {
      await cloudinary.uploader.add_context(`caption=${description}`, id);
    }
    res.json({ message: 'Cập nhật thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xóa theo ID
app.delete('/files/:id', async (req, res) => {
  const { id } = req.params;
  console.log('Deleting file with ID:', id);

  try {
    const result = await cloudinary.uploader.destroy(id, {
      resource_type: 'raw' // Thêm dòng này nếu file là JSON
    });
    res.json({ message: 'Xóa thành công', result });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug: Lấy config
app.get('/config', (req, res) => {
  res.json({
    cloud_name: cloudinary.config().cloud_name,
    api_key: cloudinary.config().api_key,
    has_secret: !!cloudinary.config().api_secret,
  });
});

// Debug: Lấy tất cả public_id (tối đa 10)
app.get('/files/public', async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression('*')
      .sort_by('created_at', 'desc')
      .max_results(100)
      .execute();
    res.json(result.resources.slice(0, 10).map(r => ({
      public_id: r.public_id,
      folder: r.folder,
      created_at: r.created_at
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
