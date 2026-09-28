import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
  sublabel?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 180,
  label,
  sublabel,
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1.5,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setDataUrl(url))
      .catch((err) => console.error('QR code generation error:', err));
  }, [value, size]);

  return (
    <div className="flex flex-col items-center">
      <div className="neo-card bg-white p-2.5 shadow-[4px_4px_0px_#000]">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`QR code for ${value}`}
            style={{ width: size, height: size }}
            className="block rounded-lg"
          />
        ) : (
          <div
            style={{ width: size, height: size }}
            className="bg-slate-100 flex items-center justify-center font-mono text-xs font-bold text-slate-500 rounded"
          >
            Generating QR...
          </div>
        )}
      </div>

      {label && (
        <span className="font-heading text-xs text-black mt-2 text-center">
          {label}
        </span>
      )}
      {sublabel && (
        <span className="font-mono text-[10px] font-bold text-slate-600 text-center max-w-[200px] truncate mt-0.5">
          {sublabel}
        </span>
      )}
    </div>
  );
};
