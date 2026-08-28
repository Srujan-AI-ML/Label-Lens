import { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ScanProduct } from './pages/ScanProduct';
import { Repository } from './pages/Repository';
import { ReportDetail } from './pages/ReportDetail';
import { LoginPage } from './pages/LoginPage';
import { AddProductModal } from './components/AddProductModal';
import { ProductProvider } from './context/ProductContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { ScannedProduct } from './types';

export type PageType = 'home' | 'scan' | 'products';

// Main app content (protected)
function AppContent() {
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [selectedProduct, setSelectedProduct] = useState<ScannedProduct | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const navigateToPage = (page: PageType) => {
    setSelectedProduct(null); // Clear selected report when switching main tabs
    setCurrentPage(page);
  };

  const viewReport = (product: ScannedProduct) => {
    setSelectedProduct(product);
  };

  const renderPage = () => {
    // If a specific report is selected, show the detail report page
    if (selectedProduct) {
      return (
        <ReportDetail 
          product={selectedProduct} 
          onBack={() => setSelectedProduct(null)} 
        />
      );
    }

    switch (currentPage) {
      case 'scan':
        return (
          <ScanProduct 
            onNavigate={navigateToPage} 
            onSelectProduct={viewReport} 
          />
        );
      case 'products':
        return (
          <Repository 
            onNavigate={navigateToPage}
            onSelectProduct={viewReport} 
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />
        );
      default:
        return (
          <Dashboard 
            onNavigate={navigateToPage} 
            onSelectProduct={viewReport} 
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />
        );
    }
  };

  return (
    <ProductProvider>
      <Layout 
        currentPage={currentPage} 
        onNavigate={navigateToPage}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      >
        <div key={selectedProduct ? selectedProduct._id || selectedProduct.id : currentPage} className="page-transition">
          {renderPage()}
        </div>
      </Layout>

      {/* Global Add Product / Scan Modal Popup */}
      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onViewReport={viewReport}
      />
    </ProductProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
