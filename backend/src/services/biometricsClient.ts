import fetch from "node-fetch";
import FormData from "form-data";

interface BiometricVerifyResponse {
  verified: boolean;
  confidence: number;
  distance: number;
  reference_count: number;
  message: string;
}

interface BiometricPhotoResponse {
  photo_id: number;
  visitor_token: string;
  faces_detected: number;
  encoding_stored: boolean;
  message: string;
}

const BIOMETRICS_SERVICE_URL = process.env.BIOMETRICS_SERVICE_URL || "http://localhost:8001";

export async function verifyFaceWithBiometrics(
  visitorToken: string,
  imageBuffer: Buffer
): Promise<BiometricVerifyResponse> {
  try {
    const form = new FormData();
    form.append("file", imageBuffer, "image.jpg");

    const response = await fetch(
      `${BIOMETRICS_SERVICE_URL}/api/biometrics/verify/${visitorToken}`,
      {
        method: "POST",
        body: form,
        headers: form.getHeaders(),
        timeout: 30000,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Biometrics verification failed");
    }

    return (await response.json()) as BiometricVerifyResponse;
  } catch (error) {
    console.error("Biometrics service error:", error);
    throw error;
  }
}

export async function addReferenceBiometricPhoto(
  visitorToken: string,
  imageBuffer: Buffer
): Promise<BiometricPhotoResponse> {
  try {
    const form = new FormData();
    form.append("file", imageBuffer, "image.jpg");

    const response = await fetch(
      `${BIOMETRICS_SERVICE_URL}/api/biometrics/photos/${visitorToken}`,
      {
        method: "POST",
        body: form,
        headers: form.getHeaders(),
        timeout: 30000,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Photo upload failed");
    }

    return (await response.json()) as BiometricPhotoResponse;
  } catch (error) {
    console.error("Biometrics photo service error:", error);
    throw error;
  }
}

export async function listBiometricPhotos(visitorToken: string) {
  try {
    const response = await fetch(
      `${BIOMETRICS_SERVICE_URL}/api/biometrics/photos/${visitorToken}`,
      { method: "GET", timeout: 10000 }
    );

    if (!response.ok) {
      throw new Error("Failed to list photos");
    }

    return await response.json();
  } catch (error) {
    console.error("Biometrics list photos error:", error);
    throw error;
  }
}

export async function deleteBiometricPhoto(photoId: number) {
  try {
    const response = await fetch(
      `${BIOMETRICS_SERVICE_URL}/api/biometrics/photos/${photoId}`,
      { method: "DELETE", timeout: 10000 }
    );

    if (!response.ok) {
      throw new Error("Failed to delete photo");
    }

    return await response.json();
  } catch (error) {
    console.error("Biometrics delete photo error:", error);
    throw error;
  }
}

export async function getVerificationLogs(visitorToken: string, limit = 50) {
  try {
    const response = await fetch(
      `${BIOMETRICS_SERVICE_URL}/api/biometrics/verification-logs/${visitorToken}?limit=${limit}`,
      { method: "GET", timeout: 10000 }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch verification logs");
    }

    return await response.json();
  } catch (error) {
    console.error("Biometrics get logs error:", error);
    throw error;
  }
}
