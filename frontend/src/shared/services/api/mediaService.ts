import type { ImageUploadResponse } from "../../types";
import { apiRequest } from "./client";

export async function uploadImageAsset(file: File, folder = "general"): Promise<ImageUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);
  return apiRequest<ImageUploadResponse>("/media/images", {
    method: "POST",
    body: formData
  });
}
