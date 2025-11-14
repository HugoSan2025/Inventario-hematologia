import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, Timestamp, query, orderBy, writeBatch, setDoc, getDocs, where, getCountFromServer } from 'firebase/firestore';
import { db } from './firebase-config';
import Header from './components/Header';
import InventoryDashboard from './components/InventoryDashboard';
import ActionPanel from './components/ActionPanel';
import { Product, Transaction, TransactionType, ProductWithStock, ActiveTab } from './types';
import { productList, warehouseName } from './data/products';
import ConfirmModal from './components/ConfirmModal';
import AddProductModal from './components/AddProductModal';
import EditProductModal from './components/EditProductModal';


const App: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [markedTransactionIds, setMarkedTransactionIds] = useState<Set<string>>(new Set());
    
    // Listen for real-time updates from Firestore for products
     useEffect(() => {
        const productsCollection = collection(db, 'products');

        // One-time check to seed data from local file if collection is empty
        const seedData = async () => {
            const snapshot = await getDocs(productsCollection);
            if (snapshot.empty) {
                console.log("Products collection is empty. Seeding data...");
                const batch = writeBatch(db);
                productList.forEach(product => {
                    const docRef = doc(productsCollection, product.id); // Use product ID as document ID
                    batch.set(docRef, product);
                });
                await batch.commit();
                console.log("Data seeded successfully.");
            }
        };
        seedData().catch(console.error);

        // Set up real-time listener for product changes
        const q = query(productsCollection, orderBy('id'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const productsData: Product[] = [];
            querySnapshot.forEach((doc) => {
                productsData.push({ ...doc.data(), id: doc.id } as Product);
            });
            setProducts(productsData);
        }, (error) => {
            console.error("Error fetching products: ", error);
        });

        return () => unsubscribe();
    }, []);

    // Listen for real-time updates from Firestore for transactions
    useEffect(() => {
        const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const transactionsData: Transaction[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                transactionsData.push({
                    ...data,
                    id: doc.id,
                    date: (data.date as Timestamp).toDate().toISOString(),
                } as Transaction);
            });
            setTransactions(transactionsData);
        }, (error) => {
            console.error("Error fetching transactions: ", error);
        });
        return () => unsubscribe();
    }, []);

    // Listen for real-time updates for marked rows
    useEffect(() => {
        const markedRowsCollection = collection(db, 'markedRows');
        const unsubscribe = onSnapshot(markedRowsCollection, (querySnapshot) => {
            const markedIds = new Set<string>();
            querySnapshot.forEach((doc) => {
                markedIds.add(doc.id);
            });
            setMarkedTransactionIds(markedIds);
        }, (error) => {
            console.error("Error fetching marked rows: ", error);
        });
        return () => unsubscribe();
    }, []);


    const [activeTab, setActiveTab] = useState<ActiveTab>('stock');
    const [searchQuery, setSearchQuery] = useState('');
    const [stockSubwarehouseFilter, setStockSubwarehouseFilter] = useState('all');
    const [stockLevelFilters, setStockLevelFilters] = useState<Set<number>>(new Set());
    
    // Modals State
    const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
    const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        onConfirm: () => void;
        confirmText?: string;
        showCancelButton?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });

    const closeModal = () => setModalState(prev => ({ ...prev, isOpen: false }));
    
    // Filters state
    const [entryStartDate, setEntryStartDate] = useState('');
    const [entryEndDate, setEntryEndDate] = useState('');
    const [appliedEntryStartDate, setAppliedEntryStartDate] = useState('');
    const [appliedEntryEndDate, setAppliedEntryEndDate] = useState('');
    
    const [exitSubwarehouseFilter, setExitSubwarehouseFilter] = useState('all');
    const [exitStartDate, setExitStartDate] = useState('');
    const [exitEndDate, setExitEndDate] = useState('');
    const [appliedExitSubwarehouseFilter, setAppliedExitSubwarehouseFilter] = useState('all');
    const [appliedExitStartDate, setAppliedExitStartDate] = useState('');
    const [appliedExitEndDate, setAppliedExitEndDate] = useState('');

    const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

    const productStock = useMemo(() => {
        const stockMap = new Map<string, number>();
        products.forEach(p => stockMap.set(p.id, 0));
        transactions.forEach(tx => {
            const currentStock = stockMap.get(tx.productId) || 0;
            if (tx.type === TransactionType.ENTRY) {
                stockMap.set(tx.productId, currentStock + tx.quantity);
            } else {
                stockMap.set(tx.productId, currentStock - tx.quantity);
            }
        });
        return stockMap;
    }, [products, transactions]);

    const productsWithStock = useMemo<ProductWithStock[]>(() => {
        return products.map(p => ({
            ...p,
            stock: productStock.get(p.id) || 0,
        }));
    }, [products, productStock]);
    
    const filteredCatalog = useMemo(() => {
        if (activeTab !== 'catalog') return [];
        return products
            .filter(product => {
                const searchLower = searchQuery.toLowerCase();
                return product.name.toLowerCase().includes(searchLower) ||
                       product.id.toLowerCase().includes(searchLower) ||
                       product.subwarehouse.toLowerCase().includes(searchLower);
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [products, searchQuery, activeTab]);

    const uniqueSubwarehouses = useMemo(() => {
        const warehouses = new Set(products.map(p => p.subwarehouse));
        return ['all', ...Array.from(warehouses).sort()];
    }, [products]);

    const filteredInventory = useMemo(() => {
        return productsWithStock.filter(product => {
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = product.name.toLowerCase().includes(searchLower) ||
                                  product.id.toLowerCase().includes(searchLower) ||
                                  product.subwarehouse.toLowerCase().includes(searchLower);

            const matchesSubwarehouse = stockSubwarehouseFilter === 'all' || product.subwarehouse === stockSubwarehouseFilter;

            const matchesStockLevel = stockLevelFilters.size === 0 ||
                stockLevelFilters.has(product.stock) ||
                (stockLevelFilters.has(5) && product.stock >= 5);

            return matchesSearch && matchesSubwarehouse && matchesStockLevel;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [productsWithStock, searchQuery, stockSubwarehouseFilter, stockLevelFilters]);
    
    const entries = useMemo(() => transactions.filter(tx => tx.type === TransactionType.ENTRY), [transactions]);
    const exits = useMemo(() => transactions.filter(tx => tx.type === TransactionType.EXIT), [transactions]);

    const parseDateAsLocal = (dateString: string) => {
        if (!dateString) return null;
        const [year, month, day] = dateString.split('-').map(Number);
        // Month is 0-indexed in JS Date constructor (0=Jan, 11=Dec)
        return new Date(year, month - 1, day, 0, 0, 0);
    };

    const filteredEntries = useMemo(() => {
        const startDate = parseDateAsLocal(appliedEntryStartDate);

        const endDate = parseDateAsLocal(appliedEntryEndDate);
        if (endDate) endDate.setHours(23, 59, 59, 999);

        return entries.filter(tx => {
            const product = productMap.get(tx.productId);
            if (!product) return false;

            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = product.name.toLowerCase().includes(searchLower) ||
                                  product.id.toLowerCase().includes(searchLower);
            
            const txDate = new Date(tx.date);
            const matchesStartDate = !startDate || txDate >= startDate;
            const matchesEndDate = !endDate || txDate <= endDate;

            return matchesSearch && matchesStartDate && matchesEndDate;
        });
    }, [entries, searchQuery, productMap, appliedEntryStartDate, appliedEntryEndDate]);

    const filteredExits = useMemo(() => {
        const startDate = parseDateAsLocal(appliedExitStartDate);

        const endDate = parseDateAsLocal(appliedExitEndDate);
        if (endDate) endDate.setHours(23, 59, 59, 999);
        
        return exits.filter(tx => {
            const product = productMap.get(tx.productId);
            if (!product) return false;

            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = product.name.toLowerCase().includes(searchLower) ||
                                  product.id.toLowerCase().includes(searchLower) ||
                                  (tx.batch && tx.batch.toLowerCase().includes(searchLower)) ||
                                  (tx.subwarehouse && tx.subwarehouse.toLowerCase().includes(searchLower));
            
            const matchesSubwarehouse = appliedExitSubwarehouseFilter === 'all' || tx.subwarehouse === appliedExitSubwarehouseFilter;
            
            const txDate = new Date(tx.date);
            const matchesStartDate = !startDate || txDate >= startDate;
            const matchesEndDate = !endDate || txDate <= endDate;

            return matchesSearch && matchesSubwarehouse && matchesStartDate && matchesEndDate;
        });
    }, [exits, searchQuery, productMap, appliedExitSubwarehouseFilter, appliedExitStartDate, appliedExitEndDate]);

    const handleNewTransaction = useCallback(async (newTx: Omit<Transaction, 'id' | 'date'>) => {
        if (newTx.type === TransactionType.EXIT) {
            const stock = productStock.get(newTx.productId) || 0;
            if (stock < newTx.quantity) {
                setModalState({
                    isOpen: true,
                    title: 'Stock Insuficiente',
                    message: `No hay suficiente stock para el producto seleccionado. Stock actual: ${stock}.`,
                    confirmText: 'Entendido',
                    onConfirm: closeModal,
                    showCancelButton: false
                });
                return;
            }
        }
        try {
            await addDoc(collection(db, 'transactions'), {
                ...newTx,
                date: new Date(),
            });

        } catch (error) {
            console.error("Error adding transaction to Firestore: ", error);
            setModalState({
                isOpen: true, title: 'Error', message: 'No se pudo registrar la transacción.', onConfirm: closeModal
            });
        }
    }, [productStock]);

    const handleDeleteTransaction = useCallback((transactionId: string) => {
        setModalState({
            isOpen: true,
            title: 'Confirmar Eliminación',
            message: '¿Está seguro de que desea eliminar esta transacción? Esta acción no se puede deshacer.',
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, 'transactions', transactionId));
                    if (markedTransactionIds.has(transactionId)) {
                        await deleteDoc(doc(db, 'markedRows', transactionId));
                    }
                    
                } catch (error) {
                    console.error("Error deleting transaction: ", error);
                    setModalState({
                       isOpen: true, title: 'Error', message: 'No se pudo eliminar la transacción.', onConfirm: closeModal
                    });
                }
                closeModal();
            }
        });
    }, [transactions, markedTransactionIds]);

    const handleToggleMarkTransaction = useCallback(async (transactionId: string) => {
        const markedDocRef = doc(db, 'markedRows', transactionId);
        try {
            const isCurrentlyMarked = markedTransactionIds.has(transactionId);
            if (isCurrentlyMarked) {
                await deleteDoc(markedDocRef);
            } else {
                await setDoc(markedDocRef, { markedAt: new Date() });
            }

        } catch (error) {
            console.error("Error toggling mark on transaction:", error);
            setModalState({
                isOpen: true, title: 'Error', message: 'No se pudo marcar/desmarcar la fila.', onConfirm: closeModal
            });
        }
    }, [markedTransactionIds]);
    
    // Product CRUD handlers
    const handleAddProduct = useCallback(async (newProduct: Product) => {
        try {
            await setDoc(doc(db, "products", newProduct.id), newProduct);
            setIsAddProductModalOpen(false);
             setModalState({
                isOpen: true, title: 'Éxito', message: 'Producto agregado correctamente.', onConfirm: closeModal, showCancelButton: false
            });
        } catch (error) {
            console.error("Error adding product:", error);
            setModalState({
                isOpen: true, title: 'Error', message: 'No se pudo agregar el producto.', onConfirm: closeModal
            });
        }
    }, []);

    const handleUpdateProduct = useCallback(async (updatedProduct: Product) => {
        try {
            const productRef = doc(db, "products", updatedProduct.id);
            await setDoc(productRef, updatedProduct, { merge: true }); // merge to be safe
            setIsEditProductModalOpen(false);
            setProductToEdit(null);
             setModalState({
                isOpen: true, title: 'Éxito', message: 'Producto actualizado correctamente.', onConfirm: closeModal, showCancelButton: false
            });
        } catch (error) {
            console.error("Error updating product:", error);
            setModalState({
                isOpen: true, title: 'Error', message: 'No se pudo actualizar el producto.', onConfirm: closeModal
            });
        }
    }, []);

    const handleDeleteProduct = useCallback(async (productId: string) => {
        // Check if product has any transactions
        const transactionsQuery = query(collection(db, 'transactions'), where('productId', '==', productId));
        const countSnapshot = await getCountFromServer(transactionsQuery);

        if (countSnapshot.data().count > 0) {
            setModalState({
                isOpen: true,
                title: 'Eliminación Bloqueada',
                message: 'Este producto no se puede eliminar porque tiene transacciones asociadas. Elimine primero las transacciones.',
                onConfirm: closeModal,
                confirmText: 'Entendido',
                showCancelButton: false
            });
            return;
        }

        setModalState({
            isOpen: true,
            title: 'Confirmar Eliminación',
            message: '¿Está seguro de que desea eliminar este producto? Esta acción no se puede deshacer.',
            onConfirm: async () => {
                closeModal();
                try {
                    await deleteDoc(doc(db, "products", productId));
                } catch (error) {
                    console.error("Error deleting product:", error);
                    setModalState({
                        isOpen: true, title: 'Error', message: 'No se pudo eliminar el producto.', onConfirm: closeModal
                    });
                }
            }
        });
    }, []);
    
    const handleOpenEditModal = (product: Product) => {
        setProductToEdit(product);
        setIsEditProductModalOpen(true);
    };

    const handleFileUpload = useCallback(async (data: any[]) => {
        const newTransactions: Omit<Transaction, 'id' | 'date'>[] = [];
        const uploadErrors: { row: number; data: any; reason: string }[] = [];

        let startIndex = 0;
        if (data.length > 0) {
            const firstRow = data[0];
            // Check for header row and skip it if present
            if (
                firstRow && Array.isArray(firstRow) && firstRow.length >= 2 &&
                typeof firstRow[0] === 'string' && firstRow[0].toLowerCase().trim().includes('item') &&
                typeof firstRow[1] === 'string' && firstRow[1].toLowerCase().trim().includes('cantidad')
            ) {
                startIndex = 1;
            }
        }

        const rowsToProcess = data.slice(startIndex);

        rowsToProcess.forEach((row, index) => {
            const rowIndex = index + 1 + startIndex; // 1-based index for user feedback
            
            // Skip empty or invalid rows
            if (!row || !Array.isArray(row) || row.every(cell => !String(cell).trim())) {
                return;
            }
            
            // Expect 2 columns: ITEM, CANTIDAD
            if (row.length < 2) {
                uploadErrors.push({ row: rowIndex, data: row.join(';'), reason: 'Formato incorrecto. Se esperan 2 columnas: ITEM, CANTIDAD.' });
                return;
            }

            const [productIdStr, quantityStr] = row.slice(0, 2).map(cell => String(cell).trim());

            if (!productIdStr || !quantityStr) {
                uploadErrors.push({ row: rowIndex, data: row.join(';'), reason: 'Faltan valores. Se requiere ITEM y CANTIDAD en las dos primeras columnas.' });
                return;
            }

            const quantity = parseInt(quantityStr, 10);
            if (isNaN(quantity) || quantity <= 0) {
                uploadErrors.push({ row: rowIndex, data: row.join(';'), reason: `Cantidad no válida: "${quantityStr}".` });
                return;
            }
            
            const product = productMap.get(productIdStr);
            if (!product) {
                uploadErrors.push({ row: rowIndex, data: row.join(';'), reason: `Producto con código "${productIdStr}" no encontrado.` });
                return;
            }
            
            newTransactions.push({
                productId: product.id,
                quantity,
                type: TransactionType.ENTRY,
                subwarehouse: product.subwarehouse
            });
        });

        if (newTransactions.length > 0) {
            try {
                const batch = writeBatch(db);
                const transactionsCollection = collection(db, 'transactions');
                newTransactions.forEach(tx => {
                    const docRef = doc(transactionsCollection);
                    batch.set(docRef, { ...tx, date: new Date() });
                });
                await batch.commit();

                const successMessage = `${newTransactions.length} entradas han sido registradas correctamente.`;
                if (uploadErrors.length === 0) {
                    setModalState({
                        isOpen: true,
                        title: 'Carga Exitosa',
                        message: successMessage,
                        onConfirm: closeModal,
                        showCancelButton: false,
                        confirmText: 'Entendido'
                    });
                } else {
                    uploadErrors.unshift({ row: 0, data: {}, reason: successMessage });
                }

            } catch(error) {
                 console.error("Error committing batch:", error);
                 uploadErrors.push({ row: 0, data: {}, reason: 'Error al guardar los datos en la base de datos.'});
            }
        }
        
        if (uploadErrors.length > 0) {
            const hasSuccessMessage = uploadErrors[0]?.row === 0;
            const successText = hasSuccessMessage ? uploadErrors.shift()!.reason : '';

            setModalState({
                isOpen: true,
                title: 'Resultado de la Carga de Archivo',
                message: (
                    <div className="text-left max-h-60 overflow-y-auto">
                        {successText && <p className="mb-2 font-bold text-green-400">{successText}</p>}
                        {uploadErrors.length > 0 && 
                            <>
                                <p className="mb-2">Se encontraron los siguientes errores y no se procesaron las filas correspondientes:</p>
                                <ul className="list-disc pl-5 space-y-1">
                                    {uploadErrors.map((err, i) => (
                                        <li key={i}>Fila {err.row}: {err.reason}</li>
                                    ))}
                                </ul>
                            </>
                        }
                    </div>
                ),
                onConfirm: closeModal,
                showCancelButton: false,
                confirmText: 'Entendido'
            });
        }
    }, [productMap]);

    // Apply & Clear filter handlers
    const applyEntryFilters = () => {
        setAppliedEntryStartDate(entryStartDate);
        setAppliedEntryEndDate(entryEndDate);
    };
    const clearEntryFilters = () => {
        setEntryStartDate(''); setEntryEndDate('');
        setAppliedEntryStartDate(''); setAppliedEntryEndDate('');
    };
    const applyExitFilters = () => {
        setAppliedExitSubwarehouseFilter(exitSubwarehouseFilter);
        setAppliedExitStartDate(exitStartDate);
        setAppliedExitEndDate(exitEndDate);
    };
    const clearExitFilters = () => {
        setExitSubwarehouseFilter('all'); setExitStartDate(''); setExitEndDate('');
        setAppliedExitSubwarehouseFilter('all'); setAppliedExitStartDate(''); setAppliedExitEndDate('');
    };

    return (
        <div className="font-sans text-slate-300">
            <Header warehouseName={warehouseName} />

            <main className="mx-auto max-w-screen-2xl p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                    <div className="lg:col-span-3">
                        <InventoryDashboard
                            inventory={filteredInventory}
                            entryTransactions={filteredEntries}
                            exitTransactions={filteredExits}
                            catalog={filteredCatalog}
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                            onDeleteTransaction={handleDeleteTransaction}
                            uniqueSubwarehouses={uniqueSubwarehouses}
                            selectedSubwarehouse={stockSubwarehouseFilter}
                            onSubwarehouseChange={setStockSubwarehouseFilter}
                            products={productsWithStock}
                            markedTransactionIds={markedTransactionIds}
                            onToggleMarkTransaction={handleToggleMarkTransaction}
                            onEditProduct={handleOpenEditModal}
                            onDeleteProduct={handleDeleteProduct}
                        />
                    </div>

                    <div className="space-y-6">
                        <ActionPanel
                            products={products}
                            onNewTransaction={handleNewTransaction}
                            onFileUpload={handleFileUpload}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            activeTab={activeTab}
                            uniqueSubwarehouses={uniqueSubwarehouses}
                            exitSubwarehouseFilter={exitSubwarehouseFilter}
                            onExitSubwarehouseChange={setExitSubwarehouseFilter}
                            exitStartDate={exitStartDate}
                            onExitStartDateChange={setExitStartDate}
                            exitEndDate={exitEndDate}
                            onExitEndDateChange={setExitEndDate}
                            entryStartDate={entryStartDate}
                            onEntryStartDateChange={setEntryStartDate}
                            entryEndDate={entryEndDate}
                            onEntryEndDateChange={setEntryEndDate}
                            onApplyEntryFilters={applyEntryFilters}
                            onClearEntryFilters={clearEntryFilters}
                            onApplyExitFilters={applyExitFilters}
                            onClearExitFilters={clearExitFilters}
                            stockLevelFilters={stockLevelFilters}
                            onStockLevelChange={setStockLevelFilters}
                            onAddProduct={() => setIsAddProductModalOpen(true)}
                        />
                    </div>
                </div>
            </main>
            
            <ConfirmModal 
                isOpen={modalState.isOpen}
                title={modalState.title}
                onConfirm={modalState.onConfirm}
                onCancel={closeModal}
                confirmText={modalState.confirmText}
                showCancelButton={modalState.showCancelButton}
            >
                {modalState.message}
            </ConfirmModal>

            <AddProductModal
                isOpen={isAddProductModalOpen}
                onSave={handleAddProduct}
                onCancel={() => setIsAddProductModalOpen(false)}
                existingProductIds={useMemo(() => new Set(products.map(p => p.id)), [products])}
            />

            <EditProductModal
                isOpen={isEditProductModalOpen}
                product={productToEdit}
                onSave={handleUpdateProduct}
                onCancel={() => {
                    setIsEditProductModalOpen(false);
                    setProductToEdit(null);
                }}
            />
        </div>
    );
};

export default App;