import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { PencilSquareIcon } from './icons';

interface EditProductModalProps {
    isOpen: boolean;
    product: Product | null;
    onSave: (product: Product) => void;
    onCancel: () => void;
}

const EditProductModal: React.FC<EditProductModalProps> = ({ isOpen, product, onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [subwarehouse, setSubwarehouse] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (product) {
            setName(product.name);
            setSubwarehouse(product.subwarehouse);
            setError('');
        }
    }, [product]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const trimmedName = name.trim();
        const trimmedSubwarehouse = subwarehouse.trim();
        
        if (!trimmedName || !trimmedSubwarehouse) {
            setError('Todos los campos son obligatorios.');
            return;
        }

        if (product) {
            onSave({ ...product, name: trimmedName, subwarehouse: trimmedSubwarehouse });
        }
    };
    
    if (!isOpen || !product) return null;

    return (
        <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity backdrop-blur-sm"></div>
            <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                    <form onSubmit={handleSubmit} className="relative transform overflow-hidden rounded-lg border border-white/10 bg-slate-800 text-left shadow-2xl shadow-black/40 transition-all sm:my-8 sm:w-full sm:max-w-lg">
                        <div className="bg-slate-800 px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                            <div className="sm:flex sm:items-start">
                                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-900 sm:mx-0 sm:h-10 sm:w-10">
                                    <PencilSquareIcon className="h-6 w-6 text-indigo-400" aria-hidden="true" />
                                </div>
                                <div className="mt-3 w-full text-center sm:ml-4 sm:mt-0 sm:text-left">
                                    <h3 className="text-base font-semibold leading-6 text-slate-100" id="modal-title">Editar Producto</h3>
                                    <div className="mt-4 space-y-4">
                                        <div>
                                            <label htmlFor="product-id-edit" className="block text-sm font-medium text-slate-300 mb-1">ITEM (Código)</label>
                                            <input
                                                type="text"
                                                id="product-id-edit"
                                                value={product.id}
                                                readOnly
                                                className="block w-full rounded-md border-slate-700 bg-slate-900 py-2 px-3 text-slate-400 shadow-sm focus:outline-none sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="product-name-edit" className="block text-sm font-medium text-slate-300 mb-1">Nombre del Producto</label>
                                            <input
                                                type="text"
                                                id="product-name-edit"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="block w-full rounded-md border-slate-600 bg-slate-700 py-2 px-3 text-slate-200 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="product-subwarehouse-edit" className="block text-sm font-medium text-slate-300 mb-1">Subalmacén</label>
                                            <input
                                                type="text"
                                                id="product-subwarehouse-edit"
                                                value={subwarehouse}
                                                onChange={(e) => setSubwarehouse(e.target.value)}
                                                className="block w-full rounded-md border-slate-600 bg-slate-700 py-2 px-3 text-slate-200 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                                required
                                            />
                                        </div>
                                         {error && <p className="text-sm text-red-400">{error}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-800/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                            <button
                                type="submit"
                                className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto"
                            >
                                Guardar Cambios
                            </button>
                             <button
                                type="button"
                                className="mt-3 inline-flex w-full justify-center rounded-md bg-slate-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-500 sm:mt-0 sm:w-auto"
                                onClick={onCancel}
                            >
                                Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditProductModal;