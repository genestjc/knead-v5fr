"use client"

import type React from "react"
import { useState, useEffect, useRef, type TouchEvent } from "react"
import Image from "next/image"
import { Header } from "@/components/header"
import { motion } from "framer-motion" // Import motion from framer-motion

// Animation variants for text fade-in
const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: "easeOut",
    },
  },
}

// Staggered children animation
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.3,
    },
  },
}

// Mock data for cover stories carousel
const coverStories = [
  {
    id: 1,
    title: "Blvck Svm",
    image: "/constant-practice-photo.jpg",
  },
  {
    id: 2,
    title: "Eli McMullen",
    image: "/placeholder.svg?height=800&width=1200&text=Eli+McMullen",
  },
  {
    id: 3,
    title: "Tarantula",
    image: "/placeholder.svg?height=800&width=1200&text=Tarantula",
  },
  {
    id: 4,
    title: "Digital Art",
    image: "/placeholder.svg?height=800&width=1200&text=Digital+Art",
  },
  {
    id: 5,
    title: "Culinary Culture",
    image: "/placeholder.svg?height=800&width=1200&text=Culinary+Culture",
  },
]

// Venue data with real images
const venues = [
  {
    id: 1,
    name: "Virginia Museum of Fine Arts",
    description: "A grand space with modern architecture and world-class exhibitions.",
    image: "/vmfa.jpg",
  },
  {
    id: 2,
    name: "Virginia Museum of History & Culture",
    description: "Rich historical setting with beautiful event spaces for intimate gatherings.",
    image: "/virginia-museum-history-culture.jpg",
  },
  {
    id: 3,
    name: "Branch Museum of Design",
    description: "Unique architectural gem perfect for creative culinary experiences.",
    image: "/branch-museum-design.jpg",
  },
]

// Chef Manning photos for slideshow - removed image #3 (andrew-food-2.jpg)
const chefManningPhotos = ["/andrew-profile.jpg", "/andrew-food-1.jpg", "/andrew-food-3.jpg", "/andrew-food-4.jpg"]

// Chance Fischer photos for slideshow
const chanceFischerPhotos = ["/chance1.jpg", "/chance2.jpg", "/chance3.jpg", "/chance4.jpg"]

// Swipeable carousel component
interface SwipeableCarouselProps {
  images: string[]
  currentIndex: number
  setCurrentIndex: (index: number) => void
  height?: string
  className?: string
  children?: React.ReactNode
}

const SwipeableCarousel: React.FC<SwipeableCarouselProps> = ({
  images,
  currentIndex,
  setCurrentIndex,
  height = "400px",
  className = "",
  children,
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  // Minimum swipe distance required (in pixels)
  const minSwipeDistance = 50

  const prevImage = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const nextImage = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      nextImage()
    } else if (isRightSwipe) {
      prevImage()
    }

    // Reset values
    setTouchStart(null)
    setTouchEnd(null)
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl ${className}`}
      style={{ height }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute inset-0 w-full h-full">
        {images.map((image, index) => (
          <div
            key={`carousel-image-${index}`}
            className="absolute inset-0 w-full h-full transition-opacity duration-300"
            style={{
              opacity: currentIndex === index ? 1 : 0,
              pointerEvents: currentIndex === index ? "auto" : "none",
              zIndex: currentIndex === index ? 1 : 0,
            }}
          >
            <Image
              src={image || "/placeholder.svg"}
              alt={`Carousel image ${index + 1}`}
              fill
              className="object-cover"
              priority={index === currentIndex || index === (currentIndex + 1) % images.length}
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        ))}
      </div>

      {/* Navigation arrows */}
      <button
        onClick={prevImage}
        className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors z-10"
        aria-label="Previous photo"
        type="button"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        onClick={nextImage}
        className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors z-10"
        aria-label="Next photo"
        type="button"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 18L15 12L9 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
        {images.map((_, index) => (
          <button
            key={`carousel-dot-${index}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setCurrentIndex(index)
            }}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentIndex ? "bg-white" : "bg-white/50"
            }`}
            aria-label={`Go to photo ${index + 1}`}
            type="button"
          />
        ))}
      </div>

      {children}
    </div>
  )
}

// Password protection component
const PasswordProtection = ({ onSuccess }: { onSuccess: () => void }) => {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Simulate a brief loading state for better UX
    setTimeout(() => {
      if (password === "michel1nman") {
        onSuccess()
      } else {
        setError("Incorrect password. Please try again.")
        setPassword("")
      }
      setIsLoading(false)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-3xl md:text-4xl font-adonis mb-4"
          >
            Knead Magazine
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-lg text-gray-300 font-georgia-pro"
          >
            Private Pitch Deck
          </motion.p>
        </div>

        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Enter Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
              placeholder="Password"
              required
              disabled={isLoading}
            />
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-sm mt-2"
              >
                {error}
              </motion.p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Verifying..." : "Access Pitch Deck"}
          </button>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-gray-400 font-georgia-pro">Blvck Svm michelinman Dinner in Richmond, VA</p>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default function PurpleBlackSvmPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const [currentChefPhoto, setCurrentChefPhoto] = useState(0) // Back to starting with first photo
  const [currentChancePhoto, setCurrentChancePhoto] = useState(0) // For Chance Fischer photos
  const [currentVenue, setCurrentVenue] = useState(0)
  const [animateSlide, setAnimateSlide] = useState(0) // Track which slide to animate
  const dinnerPartyPhotos = Array.from({ length: 7 }).map((_, i) => `/dinner-party-${i + 1}.jpg`)
  const [currentDinnerPhoto, setCurrentDinnerPhoto] = useState(0)

  // Check if user is already authenticated (stored in sessionStorage)
  useEffect(() => {
    const authenticated = sessionStorage.getItem("blvck-svm-michelinman-dinner-auth")
    if (authenticated === "true") {
      setIsAuthenticated(true)
    }
  }, [])

  const handlePasswordSuccess = () => {
    sessionStorage.setItem("blvck-svm-michelinman-dinner-auth", "true")
    setIsAuthenticated(true)
  }

  // Scroll to slide function
  const scrollToSlide = (index: number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setCurrentSlide(index)
    setAnimateSlide(index) // Set the slide to animate
    slideRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }

  // Slide components with InView hooks - simplified like About page
  const Slide = ({ id, children }: { id: number; children: React.ReactNode }) => {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setCurrentSlide(id)
              setIsVisible(true)
              setAnimateSlide(id)
            }
          })
        },
        { threshold: 0.5 },
      )

      const element = slideRefs.current[id]
      if (element) {
        observer.observe(element)
      }

      return () => {
        if (element) {
          observer.unobserve(element)
        }
      }
    }, [id])

    return (
      <div
        ref={(el) => {
          slideRefs.current[id] = el
        }}
        className="min-h-screen flex items-center justify-center py-20 px-4 md:px-8"
      >
        <motion.div
          initial="hidden"
          animate={isVisible ? "visible" : "hidden"}
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { duration: 0.8 } },
          }}
          className="w-full max-w-5xl"
        >
          {children}
        </motion.div>
      </div>
    )
  }

  // Load Instagram embed script
  useEffect(() => {
    if (typeof window !== "undefined") {
      const script = document.createElement("script")
      script.async = true
      script.src = "//www.instagram.com/embed.js"
      document.body.appendChild(script)

      return () => {
        // Cleanup script on unmount
        const existingScript = document.querySelector('script[src="//www.instagram.com/embed.js"]')
        if (existingScript) {
          document.body.removeChild(existingScript)
        }
      }
    }
  }, [])

  if (!isAuthenticated) {
    return <PasswordProtection onSuccess={handlePasswordSuccess} />
  }

  return (
    <div className="bg-black text-white overflow-x-hidden">
      <Header />

      {/* Logout button */}
      <button
        onClick={() => {
          sessionStorage.removeItem("blvck-svm-michelinman-dinner-auth")
          setIsAuthenticated(false)
        }}
        className="fixed top-4 right-4 z-50 px-4 py-2 bg-white/10 backdrop-blur-sm text-white text-sm rounded-lg hover:bg-white/20 transition-colors"
      >
        Logout
      </button>

      {/* Navigation dots */}
      <div className="fixed right-8 top-1/2 transform -translate-y-1/2 z-50 hidden md:block">
        <div className="flex flex-col space-y-4">
          {Array.from({ length: 13 }).map((_, i) => (
            <button
              key={i}
              onClick={(e) => scrollToSlide(i, e)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                currentSlide === i ? "bg-white scale-125" : "bg-gray-500 hover:bg-gray-300"
              }`}
              aria-label={`Go to slide ${i + 1}`}
              type="button"
            />
          ))}
        </div>
      </div>

      {/* Title Slide with Kitchen Background */}
      <div className="relative min-h-screen">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image src="/nisei-kitchen-blvck-svm.jpg" alt="Blvck Svm in kitchen" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-black/50" />
        </div>

        <Slide id={0}>
          <div className="flex flex-col items-center justify-center text-center space-y-8 relative z-10">
            <motion.h1
              variants={fadeIn}
              className="text-4xl md:text-6xl lg:text-7xl font-adonis tracking-widest text-shadow-lg"
            >
              Blvck Svm michelinman Dinner
            </motion.h1>
            <motion.h2 variants={fadeIn} className="text-2xl md:text-3xl font-georgia-pro tracking-wide text-shadow-md">
              in Richmond, VA
            </motion.h2>
            <motion.div variants={fadeIn} className="pt-8">
              <p className="text-xl md:text-2xl font-georgia-pro">Presented by</p>
              <p className="text-3xl md:text-4xl font-adonis mt-2 tracking-wider">Knead Magazine</p>
            </motion.div>
            <motion.div variants={fadeIn} className="pt-12">
              <p className="text-lg italic text-gray-300 font-georgia-pro">Scroll down to explore</p>
              <div className="animate-bounce mt-4 flex justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 5V19M12 19L5 12M12 19L19 12"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </motion.div>
          </div>
        </Slide>
      </div>

      {/* Slide 1 - About Knead */}
      <Slide id={1}>
        <motion.h2 variants={fadeIn} className="text-3xl md:text-5xl font-adonis mb-8 text-center">
          About Knead
        </motion.h2>
        <motion.div variants={fadeIn} className="max-w-3xl mx-auto text-center">
          <p className="text-xl md:text-2xl font-georgia-pro mb-6">
            Knead is a magazine that nourishes the creative spirit.
          </p>
          <p className="text-xl md:text-2xl font-georgia-pro">
            We cover art, music, tech, fashion, food, and other creative disciplines.
          </p>
        </motion.div>
      </Slide>

      {/* Slide 2 - About Blvck Svm */}
      <Slide id={2}>
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <motion.h2 variants={fadeIn} className="text-3xl md:text-4xl font-adonis">
              Blvck Svm
            </motion.h2>
            <motion.p variants={fadeIn} className="text-lg md:text-xl font-georgia-pro">
              Blvck Svm is a musician based out of Chicago.
            </motion.p>
            <motion.p variants={fadeIn} className="text-lg md:text-xl font-georgia-pro">
              In November 2024, he released the album <i>michelinman</i>, which was created by touring fine dining
              restaurants across the US (including the Michelin Star Nisei in San Francisco) interviewing chefs on their
              process, ingredients, and sourcing.
            </motion.p>
            <motion.p variants={fadeIn} className="text-lg md:text-xl font-georgia-pro">
              To accommodate the process, Blvck Svm created The Bvck of House series, a visual collection of
              performances in the kitchens he visited.
            </motion.p>
          </div>
          <motion.div variants={fadeIn}>
            <Image
              src="/blvck-svm-kitchen.jpg"
              alt="Blvck Svm performing in a professional kitchen"
              width={600}
              height={400}
              className="rounded-xl object-cover w-full h-[400px] shadow-lg"
            />
            <p className="text-sm text-gray-400 mt-2 text-center font-georgia-pro italic">
              Blvck Svm in Freya (Detroit)
            </p>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 3 - Bvck of House Example */}
      <Slide id={3}>
        <div className="flex flex-col items-center">
          <motion.h2 variants={fadeIn} className="text-3xl md:text-4xl font-adonis mb-8 text-center">
            Bvck of House
          </motion.h2>
          <motion.div
            variants={fadeIn}
            className="w-full max-w-4xl aspect-video bg-gray-900 rounded-xl overflow-hidden"
          >
            <div className="relative w-full h-0 pb-[56.25%]">
              <iframe
                src="https://www.youtube.com/embed/cZMXDGFSdbo?si=1bChnb37KQ7Yb3LH"
                title="Blvck Svm - Bvck of House"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              ></iframe>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 4 - michelinman Dinner Parties */}
      <Slide id={4}>
        <div className="space-y-8">
          <motion.h2 variants={fadeIn} className="text-3xl md:text-4xl font-adonis text-center">
            michelinman Dinner Parties
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Dinner Party Slideshow */}
            <motion.div variants={fadeIn} className="flex justify-center">
              <div className="w-full max-w-md">
                <SwipeableCarousel
                  images={dinnerPartyPhotos}
                  currentIndex={currentDinnerPhoto}
                  setCurrentIndex={setCurrentDinnerPhoto}
                  height="400px"
                />
              </div>
            </motion.div>
            <div className="space-y-4">
              <motion.p variants={fadeIn} className="text-lg md:text-xl font-georgia-pro">
                Kicking off 2025, Blvck Svm has been collaborating with chefs across the country for michelinman dinner
                parties.
              </motion.p>
              <motion.p variants={fadeIn} className="text-lg md:text-xl font-georgia-pro">
                These have included a sold-out night at Brutø in Denver, as well as three sold-out nights at Heirloom in
                Rogers, Arkansas.
              </motion.p>
              <motion.p variants={fadeIn} className="text-lg md:text-xl font-georgia-pro">
                The chefs are free to interpret and reorganize the songs on the album, creating a menu that highlights
                their inspiration from the music.
              </motion.p>
              <motion.p variants={fadeIn} className="text-lg md:text-xl font-georgia-pro">
                During the dinner, Blvck Svm and the chef go back and forth talking about their thinking behind each
                respective dish and song pairing.
              </motion.p>
            </div>
          </div>
        </div>
      </Slide>

      {/* Slide 5 - Blvck Svm's Reach */}
      <Slide id={5}>
        <div className="space-y-8">
          <motion.h2 variants={fadeIn} className="text-3xl md:text-4xl font-adonis text-center">
            {"Blvck Svm's Reach"}
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              variants={fadeIn}
              className="bg-white/5 backdrop-blur-sm p-8 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M23.5 6.50708C23.3641 6.02231 23.0994 5.58342 22.734 5.23708C22.3583 4.88008 21.8978 4.62471 21.396 4.50008C19.518 4.00008 12 4.00008 12 4.00008C12 4.00008 4.482 4.00008 2.604 4.50008C2.10224 4.62471 1.64166 4.88008 1.266 5.23708C0.900566 5.58342 0.635863 6.02231 0.5 6.50708C0.0109998 10.1891 -0.120859 13.9101 0.113 17.6071C0.240651 18.0969 0.505231 18.5474 0.879 18.9071C1.26567 19.2641 1.72623 19.5194 2.228 19.6441C4.106 20.1441 12 20.1441 12 20.1441C12 20.1441 19.518 20.1441 21.396 19.6441C21.8978 19.5194 22.3583 19.2641 22.734 18.9071C23.1088 18.5474 23.3734 18.0969 23.5 17.6071C23.9601 13.9286 24.0562 10.2078 23.8 6.50708"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.75 16.0071L15.5 12.0071L9.75 8.00708V16.0071Z"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-center mb-2">YouTube</h3>
              <p className="text-center text-gray-300 font-georgia-pro">1,377,988 views</p>
              <p className="text-center text-gray-300 font-georgia-pro">10.2k subscribers</p>
            </motion.div>

            <motion.div
              variants={fadeIn}
              className="bg-white/5 backdrop-blur-sm p-8 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M17 2H7C4.23858 2 2 4.23858 2 7V17C2 19.7614 4.23858 22 7 22H17C19.7614 22 22 19.7614 22 17V7C22 4.23858 19.7614 2 17 2Z"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 11.3701C16.1234 12.2023 15.9813 13.0523 15.5938 13.7991C15.2063 14.5459 14.5932 15.1515 13.8416 15.5297C13.0901 15.908 12.2385 16.0397 11.4078 15.906C10.5771 15.7723 9.80977 15.3801 9.21485 14.7852C8.61993 14.1903 8.22774 13.4229 8.09408 12.5923C7.96042 11.7616 8.09208 10.91 8.47034 10.1584C8.8486 9.40691 9.4542 8.7938 10.201 8.4063C10.9478 8.0188 11.7978 7.87665 12.63 8.00006C13.4789 8.12594 14.2649 8.52152 14.8717 9.12836C15.4785 9.73521 15.8741 10.5211 16 11.3701Z"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M17.5 6.5H17.51"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-center mb-2">Instagram</h3>
              <p className="text-center text-gray-300 font-georgia-pro">31.7k followers</p>
            </motion.div>

            <motion.div
              variants={fadeIn}
              className="bg-white/5 backdrop-blur-sm p-8 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-center mb-2">TikTok</h3>
              <p className="text-center text-gray-300 font-georgia-pro">17.9k followers</p>
            </motion.div>
          </div>
        </div>
      </Slide>

      {/* Slide 6 - The Event */}
      <Slide id={6}>
        <div className="space-y-8">
          <motion.h2 variants={fadeIn} className="text-3xl md:text-4xl font-adonis text-center">
            The Event: michelinman Dinner Party in Richmond, Virginia
          </motion.h2>
          <motion.div variants={fadeIn} className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg md:text-xl font-georgia-pro text-center">
              Knead would like to bring Blvck Svm for a dinner party with Chef Andrew Manning and Maitre'd Chance
              Fischer.
            </p>
            <p className="text-lg md:text-xl font-georgia-pro text-center">
              We're talking with many of the museums around Richmond, including the Virginia Museum of Fine Arts,
              Virginia Museum of History & Culture, and the Branch Museum of Design.
            </p>
            <p className="text-lg md:text-xl font-georgia-pro text-center">
              The event could potentially be two nights.
            </p>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 7 - Chef Andrew Manning */}
      <Slide id={7}>
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <motion.h2 variants={fadeIn} className="text-3xl md:text-4xl font-adonis">
              Chef Andrew Manning
            </motion.h2>
            <motion.p variants={fadeIn} className="text-lg md:text-xl font-georgia-pro">
              Chef Manning is based out of Richmond, VA.
            </motion.p>
            <motion.p variants={fadeIn} className="text-lg md:text-xl font-georgia-pro">
              Spending a lot of his career cooking in Northern Italy, Chef Manning moved back and cofounded Longoven,
              which Bon Appétit twice named one of the best new restaurants in America (2016, 2019). The team also
              cofounded the Italian restaurant, Lost Letter, where he served as Head Chef for both.
            </motion.p>
            <motion.p variants={fadeIn} className="text-lg md:text-xl font-georgia-pro">
              Manning currently runs Nokoribi, which is a Japanese pub-inspired restaurant.
            </motion.p>
          </div>
          <motion.div variants={fadeIn} className="relative">
            <SwipeableCarousel
              images={chefManningPhotos}
              currentIndex={currentChefPhoto}
              setCurrentIndex={setCurrentChefPhoto}
              height="400px"
            />
            <p className="text-sm text-gray-400 mt-2 text-center font-georgia-pro italic">
              Photos:{" "}
              <a
                href="https://www.starchefs.com/on-the-ground/andrew-manning"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Will Blunt via StarChef
              </a>
            </p>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 8 - Maitre'd Chance Fischer */}
      <Slide id={8}>
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <motion.h2 variants={fadeIn} className="text-3xl md:text-4xl font-adonis">
              Maitre'd Chance Fischer
            </motion.h2>
            <motion.p variants={fadeIn} className="text-lg md:text-xl font-georgia-pro">
              Chance Fischer has been managing restaurants and pop-ups in Richmond for nearly two decades.
            </motion.p>
            <motion.p variants={fadeIn} className="text-lg md:text-xl font-georgia-pro">
              Previously, Fischer was GM at the social club Common House, as well as Lemaire, the restaurant inside The
              Jefferson (a five-star luxury hotel).
            </motion.p>
            <motion.p variants={fadeIn} className="text-lg md:text-xl font-georgia-pro">
              Fischer has most recently worked on Secret Super Society, a private dinner tasting menu series.
            </motion.p>
          </div>
          <motion.div variants={fadeIn} className="relative">
            <SwipeableCarousel
              images={chanceFischerPhotos}
              currentIndex={currentChancePhoto}
              setCurrentIndex={setCurrentChancePhoto}
              height="400px"
            />
            <p className="text-sm text-gray-400 mt-2 text-center font-georgia-pro italic">
              Photos via{" "}
              <a
                href="https://www.thesecretss.com/gallery"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Secret Super Society
              </a>
            </p>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 9 - The Venues */}
      <Slide id={9}>
        <div className="space-y-8">
          <motion.h2 variants={fadeIn} className="text-3xl md:text-4xl font-adonis text-center">
            The Venues
          </motion.h2>
          <motion.div variants={fadeIn} className="relative max-w-4xl mx-auto">
            <SwipeableCarousel
              images={venues.map((venue) => venue.image)}
              currentIndex={currentVenue}
              setCurrentIndex={setCurrentVenue}
              height="500px"
            >
              <div className="absolute bottom-0 left-0 right-0 p-8 text-white z-10">
                <h3 className="text-2xl font-adonis mb-2">{venues[currentVenue].name}</h3>
                <p className="text-lg font-georgia-pro">{venues[currentVenue].description}</p>
              </div>
            </SwipeableCarousel>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 10 - What We're Asking For */}
      <Slide id={10}>
        <div className="max-w-4xl mx-auto space-y-8">
          <motion.h2 variants={fadeIn} className="text-3xl md:text-4xl font-adonis text-center mb-6">
            What We're Asking For
          </motion.h2>
          <motion.p variants={fadeIn} className="text-xl md:text-2xl font-georgia-pro font-bold mb-4">
            We're looking to raise $13,200 in sponsorship for the event.
          </motion.p>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Bullet points */}
            <motion.div variants={fadeIn} className="w-full md:w-1/2 space-y-4">
              <ul className="list-disc pl-6 space-y-4">
                <li className="text-lg md:text-xl font-georgia-pro">
                  <span className="font-bold">Blvck Svm Overhead + Content Team</span>
                  <br />
                  <span className="text-gray-300">(Incl. Travel/Lodging):</span> $4,000
                </li>
                <li className="text-lg md:text-xl font-georgia-pro">
                  <span className="font-bold">Knead</span>
                  <br />
                  <span className="text-gray-300">(Production/Talent):</span> $3,000
                </li>
                <li className="text-lg md:text-xl font-georgia-pro">
                  <span className="font-bold">Venue:</span> $5,000
                </li>
                <li className="text-lg md:text-xl font-georgia-pro">
                  <span className="font-bold">Supplies/Incidentals:</span> $1,200
                </li>
              </ul>
              <p className="text-lg md:text-xl font-georgia-pro italic pt-4">
                Would love to hear about product offerings to help offset supply costs.
              </p>
            </motion.div>

            {/* Visual breakdown */}
            <motion.div variants={fadeIn} className="w-full md:w-1/2">
              <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl">
                <h3 className="text-xl font-bold mb-4 text-center">Cost Breakdown</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Blvck Svm + Content Team</span>
                      <span>$4,000</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-3">
                      <div className="bg-blue-500 h-3 rounded-full" style={{ width: "30%" }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Knead</span>
                      <span>$3,000</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-3">
                      <div className="bg-purple-500 h-3 rounded-full" style={{ width: "23%" }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Venue</span>
                      <span>$5,000</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-3">
                      <div className="bg-green-500 h-3 rounded-full" style={{ width: "38%" }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Supplies/Incidentals</span>
                      <span>$1,200</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-3">
                      <div className="bg-yellow-500 h-3 rounded-full" style={{ width: "9%" }}></div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/20 mt-4">
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span>$13,200</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </Slide>

      {/* Slide 11 - Vision Statement */}
      <Slide id={11}>
        <motion.div variants={fadeIn} className="max-w-4xl mx-auto text-center space-y-8">
          <p className="text-xl md:text-2xl font-georgia-pro">
            The michelinman dinner party series is creating a new type of culturally-rich experience.
          </p>
          <p className="text-xl md:text-2xl font-georgia-pro">
            By perfectly blending fine dining and music in an intimate way, this dinner sets a precedent for how
            artists, chefs, creatives, and brands can reach their audience through groundbreaking memorable experiences.
          </p>
          <p className="text-xl md:text-2xl font-georgia-pro">
            If successful, we're looking to expand this series to other cities as well.
          </p>
        </motion.div>
      </Slide>

      {/* Slide 12 - Thank You */}
      <Slide id={12}>
        <motion.div variants={fadeIn} className="flex items-center justify-center min-h-[60vh]">
          <h2 className="text-4xl md:text-6xl font-adonis text-center">Thanks for reading.</h2>
        </motion.div>
      </Slide>
    </div>
  )
}
