import { NoticeBar, SiteFooter, SiteHeader, StickyCta } from "@/components/SiteChrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only skip">Skip to content</a>
      <NoticeBar />
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
      <StickyCta />
    </>
  );
}
