import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const IV_LENGTH = 16;

/**
 * Encrypt sensitive data (like SMTP passwords)
 */
export function encrypt(text) {
  if (!text) return null;
  
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), "utf8");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  return iv.toString("hex") + ":" + encrypted;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  try {
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), "utf8");
    const parts = encryptedText.split(":");
    const iv = Buffer.from(parts.shift(), "hex");
    const encrypted = parts.join(":");
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    return null;
  }
}

