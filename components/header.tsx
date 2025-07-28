"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu } from "@/components/menu";
import { ThirdWebConnectButton } from "@/components/thirdweb-connect-button";
import { WalletSummary } from "@/components/wallet-summary";
import { useActiveAccount } from "thirdweb/react";

export function Header() {
  const [scrollY, setScrollY] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const account = useActiveAccount();

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    return () =>
      window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    document.body.style.overflow = isMenuOpen
      ? "auto"
      : "hidden";
  };

  // Calculate header opacity and transform based on scroll
  const getHeaderOpacity = () => {
    const fadeStart = 100;
    const fadeEnd = 300;
    if (scrollY <= fadeStart) return 1;
    if (scrollY >= fadeEnd) return 0.1;
    return (
      1 -
      ((scrollY - fadeStart) / (fadeEnd - fadeStart)) * 0.9
    );
  };

  // Calculate logo transform - shrink "Knead" to "K" as we scroll
  const getLogoTransform = () => {
    const transformStart = 50;
    const transformEnd = 200;
    if (scrollY <= transformStart)
      return { scale: 1, showFull: true };
    if (scrollY >= transformEnd)
      return { scale: 0.7, showFull: false };

    const progress =
      (scrollY - transformStart) /
      (transformEnd - transformStart);
    return {
      scale: 1 - progress * 0.3,
      showFull: progress < 0.5,
    };
  };

  const headerOpacity = getHeaderOpacity();
  const logoTransform = getLogoTransform();
  const isScrolled = scrollY > 30;

  return (
    <>
      <header
        className="header-container"
        style={{
          opacity: headerOpacity,
          backgroundColor: isScrolled
            ? "rgba(255, 255, 255, 0.95)"
            : "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(10px)",
          borderBottom: isScrolled
            ? "1px solid rgba(0, 0, 0, 0.1)"
            : "1px solid transparent",
          boxShadow: isScrolled
            ? "0 2px 20px rgba(0, 0, 0, 0.08)"
            : "none",
          transform: `translateY(${scrollY > 400 ? -100 : 0}px)`,
        }}
      >
        <div className="max-w-[90%] mx-auto w-full flex justify-between items-center py-6">
          {/* Logo with scroll transformation */}
          <Link
            href="/"
            className="k-logo font-adonis text-black hover:opacity-80 transition-all duration-300"
            style={{
              transform: `scale(${logoTransform.scale})`,
              fontSize: logoTransform.showFull
                ? "2rem"
                : "1.8rem",
            }}
          >
            {logoTransform.showFull ? "Knead" : "K"}
          </Link>

          <div className="flex items-center space-x-4">
            {/* Show only one: WalletSummary if connected, else Sign In button */}
            {account ? (
              <WalletSummary />
            ) : (
              <ThirdWebConnectButton />
            )}

            {/* Hamburger Menu */}
            <div
              className={`hamburger-icon ${isMenuOpen ? "hamburger-open" : ""}`}
              onClick={toggleMenu}
              aria-label="Toggle menu"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleMenu();
                }
              }}
            >
              <span
                className="hamburger-line"
                style={{
                  backgroundColor: isMenuOpen
                    ? "white"
                    : "black",
                }}
              ></span>
              <span
                className="hamburger-line"
                style={{
                  backgroundColor: isMenuOpen
                    ? "white"
                    : "black",
                }}
              ></span>
              <span
                className="hamburger-line"
                style={{
                  backgroundColor: isMenuOpen
                    ? "white"
                    : "black",
                }}
              ></span>
            </div>
          </div>
        </div>
      </header>

      <Menu
        isOpen={isMenuOpen}
        onClose={() => {
          setIsMenuOpen(false);
          document.body.style.overflow = "auto";
        }}
      />

      <div className="h-24"></div>

      <style jsx>{`
        .hamburger-icon {
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          width: 28px;
          height: 22px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .hamburger-line {
          width: 100%;
          height: 2.5px;
          transition: all 0.3s ease;
          transform-origin: center;
        }

        .hamburger-open .hamburger-line:nth-child(1) {
          transform: rotate(45deg) translate(6px, 6px);
        }

        .hamburger-open .hamburger-line:nth-child(2) {
          opacity: 0;
        }

        .hamburger-open .hamburger-line:nth-child(3) {
          transform: rotate(-45deg) translate(8px, -7px);
        }
      `}</style>
    </>
  );
}
