/// <reference types="vite/client" />

// Make React namespace globally available (used as React.JSX.Element, React.ReactNode, etc.)
import type React from 'react'
declare global {
  export { React }
}

// Electron webview tag support in JSX
declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string
          partition?: string
          allowpopups?: boolean
          preload?: string
          httpreferrer?: string
          useragent?: string
          disablewebsecurity?: string
          nodeintegration?: string
          nodeintegrationinsubframes?: string
          webpreferences?: string
        },
        HTMLElement
      >
    }
  }
}
