/// <reference types="vite/client" />

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
