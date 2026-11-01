// Fit the whole image (no crop) into a small thumbnail; preserve the existing
// symbol field and its 3,000-character limit, so old records need no migration.
export const isProjectImage=value=>/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value||'');
export async function prepareProjectImage(file){
 if(!file||!/^image\//.test(file.type))throw Error('Выбери изображение из фото или файлов.');
 if(file.size>20*1024*1024)throw Error('Это изображение слишком большое. Выбери файл до 20 МБ.');
 const url=URL.createObjectURL(file),image=new Image();
 try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Не удалось открыть изображение. Попробуй PNG, JPEG или WebP.'));image.src=url;});
  for(const size of [80,64,48,32]){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d');const ratio=Math.min((size-4)/image.naturalWidth,(size-4)/image.naturalHeight),w=image.naturalWidth*ratio,h=image.naturalHeight*ratio;c.drawImage(image,(size-w)/2,(size-h)/2,w,h);for(const quality of [.85,.65,.4]){const value=canvas.toDataURL('image/webp',quality);if(value.length<=3000&&isProjectImage(value))return value;}}
  throw Error('Не удалось подготовить миниатюру. Попробуй другое изображение.');
 }finally{URL.revokeObjectURL(url);}
}
