export interface UploadResult {
  fileId: string;
  filename: string;
  url: string;
  contentType: string;
  size: number;
}

export async function uploadResume(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/v1/upload/resume', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload resume');
  }

  return (await response.json()) as UploadResult;
}

export async function uploadCompanyDoc(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/v1/upload/company-doc', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload document');
  }

  return (await response.json()) as UploadResult;
}
