
import React from 'react';

interface LoaderProps {
  status: string;
}

const Loader: React.FC<LoaderProps> = ({ status }) => (
  <div className="flex flex-col items-center justify-center text-center p-8">
    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
    <p className="text-xl font-semibold text-gray-700 mt-6">{status}</p>
    <p className="text-gray-500 mt-2">Isso pode levar alguns instantes. Por favor, aguarde.</p>
  </div>
);

export default Loader;
