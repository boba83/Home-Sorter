import React from 'react';
import { Button } from '@/components/ui/button';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[40vh] flex items-center justify-center p-8">
          <div className="max-w-lg w-full rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Greška na stranici</h2>
            <p className="text-sm text-red-700 mb-4 break-words">
              {this.state.error?.message || 'Nepoznata greška'}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Osveži stranicu
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
