import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import admin from "firebase-admin";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(), // This works in Cloud Run
    // If not in Cloud Run, it might fail, but we'll handle it
  });
}

const db = admin.firestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Multer configuration
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  });
  const upload = multer({ storage });

  // Mercado Pago Configuration
  const client = new MercadoPagoConfig({ 
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'APP_USR-5903334937452237-040918-dd01c9c0d5a71c54abb5df59dd4e231e-3326778756' 
  });

  // API Routes
  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No se subió ningún archivo" });
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });

  app.post("/api/create-preference", async (req, res) => {
    try {
      const { planName, price, userId } = req.body;

      const preference = new Preference(client);
      const result = await preference.create({
        body: {
          items: [
            {
              id: planName,
              title: `Aura Lab - Plan ${planName}`,
              quantity: 1,
              unit_price: Number(price),
              currency_id: 'ARS'
            }
          ],
          back_urls: {
            success: `${req.headers.origin}/payment-success`,
            failure: `${req.headers.origin}/payment-failure`,
            pending: `${req.headers.origin}/payment-pending`,
          },
          auto_return: 'approved',
          external_reference: userId,
          notification_url: `${req.headers.origin}/api/webhook/mercadopago`
        }
      });

      res.json({ id: result.id, init_point: result.init_point });
    } catch (error) {
      console.error("Error creating MP preference:", error);
      res.status(500).json({ error: "Error al crear la preferencia de pago" });
    }
  });

  app.post("/api/webhook/mercadopago", async (req, res) => {
    const { action, data, type } = req.body;

    // Mercado Pago sends different types of notifications
    // We are interested in 'payment' type and 'payment.created' or 'payment.updated' action
    if ((type === 'payment' || action === 'payment.created' || action === 'payment.updated') && data?.id) {
      try {
        const paymentId = data.id;
        const payment = new Payment(client);
        const paymentData = await payment.get({ id: paymentId });

        if (paymentData.status === 'approved') {
          const userId = paymentData.external_reference;
          const planName = paymentData.additional_info?.items?.[0]?.id?.toLowerCase() || 'pro';

          if (userId) {
            console.log(`Updating plan for user ${userId} to ${planName}`);
            const userRef = db.collection("users").doc(userId);
            await userRef.update({
              plan: planName,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      } catch (error) {
        console.error("Error processing MP webhook:", error);
      }
    }

    res.sendStatus(200);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  return app;
}

export const appPromise = startServer();
export default appPromise;
