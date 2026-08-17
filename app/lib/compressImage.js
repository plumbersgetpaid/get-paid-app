// Resizes and compresses an image file in the browser before it's
// uploaded, so full-resolution phone photos (often 3-8MB, sometimes much
// more) don't blow past Vercel's serverless function request size limit
// (~4.5MB) once one or more are attached to a single form submission.
// Only ever call this from a client component - it uses browser-only APIs
// (Image, canvas, FileReader) that don't exist on the server.
//
// Always exported as JPEG unless preserveTransparency is explicitly
// passed true - JPEG has no alpha channel at all, so any transparent
// area silently becomes solid black once flattened onto it. That's
// exactly the right tradeoff for a camera photo (never transparent to
// begin with, and JPEG compresses photographic detail far better than
// PNG does) but the wrong one for a logo, where a transparent
// background is very often the entire point. Defaults to false so the
// two existing photo callers (job photos, note attachments) keep their
// current behaviour completely unchanged - only logo uploads need to
// opt in.
export async function compressImage(file, maxDimension = 1600, quality = 0.75, preserveTransparency = false) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const outputType = preserveTransparency ? "image/png" : "image/jpeg";
        const outputExt = preserveTransparency ? ".png" : ".jpg";

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Could not compress image"));
              return;
            }
            const newName = file.name.replace(/\.\w+$/, "") + outputExt;
            resolve(new File([blob], newName, { type: outputType }));
          },
          outputType,
          preserveTransparency ? undefined : quality
        );
      };
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}
