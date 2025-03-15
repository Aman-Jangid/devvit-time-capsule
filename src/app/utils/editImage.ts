import { Canvas, getFabricDocument, FabricImage } from "fabric";

const getPostDetails = async (details: any) => {
  const imagePath = `/assets/teaser/${details.theme || "default"}.jpg`;
  const textLines = details.textLines || ["Default Line"];
  const dataURL = await editImage(imagePath, textLines);
  return { image: dataURL };
};

const editImage = async (imagePath: string, textLines: string[]) => {
  return new Promise<string>((resolve, reject) => {
    const canvasElement = getFabricDocument().createElement("canvas");

    const canvas = new Canvas(canvasElement);
    FabricImage.fromURL(imagePath, (image) => {
      image;
    });
    FabricImage.fromURL(
      imagePath,
      (img) => {
        canvas.setWidth(img.width);
        canvas.setHeight(img.height);
        canvas.add(img);
        const f = 24; // Font size
        const s = f / 2; // Space between lines
        const l = f + s; // Line height
        const a = 0.8 * f; // Approximate ascent
        const d = 0.2 * f; // Approximate descent
        const n = textLines.length;
        const totalTextHeight = (n - 1) * l + a + d;
        const startY = (canvas.height - totalTextHeight) / 2 + a;
        const x_position = canvas.width / 2;
        for (let i = 0; i < n; i++) {
          const y_position = startY + i * l;
          const top = y_position - a;
          const textObject = new fabric.Text(textLines[i], {
            left: x_position,
            top: top,
            originX: "center",
            fontFamily: "Arial",
            fill: "black",
            fontSize: f,
          });
          canvas.add(textObject);
        }
        const dataURL = canvas.toDataURL();
        resolve(dataURL);
      },
      reject
    );
  });
};

export default getPostDetails;
