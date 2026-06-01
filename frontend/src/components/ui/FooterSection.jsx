import * as React from "react"
import { Button } from "./Button"
import { Input } from "./Input"
import { Label } from "./Label"
import { Switch } from "./Switch"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./Tooltip"
import { Facebook, Instagram, Linkedin, Moon, Send, Sun, Twitter } from "lucide-react"

export function FooterSection() {
    const [isDarkMode, setIsDarkMode] = React.useState(true)

    React.useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add("dark")
        } else {
            document.documentElement.classList.remove("dark")
        }
    }, [isDarkMode])

    return (
        <footer className="relative border-t border-white/5 bg-gradient-to-t from-black/80 via-black/40 to-transparent backdrop-blur-[2px] text-gray-300 transition-colors duration-300 z-50">
            <div className="container mx-auto px-4 py-12 md:px-6 lg:px-8 relative z-10">
                <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
                    <div className="relative">
                        <h2 className="mb-4 text-3xl font-bold tracking-tight text-white">Stay Connected</h2>
                        <p className="mb-6 text-gray-400">
                            Join our newsletter for the latest updates and exclusive offers.
                        </p>
                        <form className="relative" onSubmit={(e) => e.preventDefault()}>
                            <Input
                                type="email"
                                placeholder="Enter your email"
                                className="pr-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 backdrop-blur-sm focus-visible:ring-indigo-500"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                className="absolute right-1 top-1 h-8 w-8 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 transition-transform hover:scale-105"
                            >
                                <Send className="h-4 w-4" />
                                <span className="sr-only">Subscribe</span>
                            </Button>
                        </form>
                        <div className="absolute -right-4 top-0 h-24 w-24 rounded-full bg-indigo-500/20 blur-2xl -z-10" />
                    </div>
                    <div>
                        <h3 className="mb-4 text-lg font-semibold text-white">Quick Links</h3>
                        <nav className="space-y-2 text-sm">
                            <a href="#" className="block transition-colors hover:text-cyan-400">
                                Home
                            </a>
                            <a href="#" className="block transition-colors hover:text-cyan-400">
                                About Us
                            </a>
                            <a href="#" className="block transition-colors hover:text-cyan-400">
                                Services
                            </a>
                            <a href="#" className="block transition-colors hover:text-cyan-400">
                                Products
                            </a>
                            <a href="#" className="block transition-colors hover:text-cyan-400">
                                Contact
                            </a>
                        </nav>
                    </div>
                    <div>
                        <h3 className="mb-4 text-lg font-semibold text-white">Contact Us</h3>
                        <address className="space-y-2 text-sm not-italic text-gray-400">
                            <p>123 Innovation Street</p>
                            <p>Tech City, TC 12345</p>
                            <p>Phone: (123) 456-7890</p>
                            <p>Email: hello@example.com</p>
                        </address>
                    </div>
                    <div className="relative">
                        <h3 className="mb-4 text-lg font-semibold text-white">Follow Us</h3>
                        <div className="mb-6 flex space-x-4">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="icon" className="rounded-full border-white/10 bg-white/5 hover:bg-white/10 hover:text-cyan-400">
                                            <Facebook className="h-4 w-4" />
                                            <span className="sr-only">Facebook</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-gray-900 border-gray-800 text-white">
                                        <p>Follow us on Facebook</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="icon" className="rounded-full border-white/10 bg-white/5 hover:bg-white/10 hover:text-cyan-400">
                                            <Twitter className="h-4 w-4" />
                                            <span className="sr-only">Twitter</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-gray-900 border-gray-800 text-white">
                                        <p>Follow us on Twitter</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="icon" className="rounded-full border-white/10 bg-white/5 hover:bg-white/10 hover:text-cyan-400">
                                            <Instagram className="h-4 w-4" />
                                            <span className="sr-only">Instagram</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-gray-900 border-gray-800 text-white">
                                        <p>Follow us on Instagram</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="icon" className="rounded-full border-white/10 bg-white/5 hover:bg-white/10 hover:text-cyan-400">
                                            <Linkedin className="h-4 w-4" />
                                            <span className="sr-only">LinkedIn</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-gray-900 border-gray-800 text-white">
                                        <p>Connect with us on LinkedIn</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Sun className="h-4 w-4 text-gray-400" />
                            <Switch
                                id="dark-mode"
                                checked={isDarkMode}
                                onCheckedChange={setIsDarkMode}
                                className="data-[state=checked]:bg-indigo-600"
                            />
                            <Moon className="h-4 w-4 text-indigo-400" />
                            <Label htmlFor="dark-mode" className="sr-only">
                                Toggle dark mode
                            </Label>
                        </div>
                    </div>
                </div>
                <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-center md:flex-row">
                    <p className="text-sm text-gray-500">
                        © 2026 FinIntel Inc. All rights reserved.
                    </p>
                    <nav className="flex gap-4 text-sm">
                        <a href="#" className="transition-colors hover:text-cyan-400">
                            Privacy Policy
                        </a>
                        <a href="#" className="transition-colors hover:text-cyan-400">
                            Terms of Service
                        </a>
                        <a href="#" className="transition-colors hover:text-cyan-400">
                            Cookie Settings
                        </a>
                    </nav>
                </div>
            </div>

            {/* Footer Ambient Glow */}
            <div className="absolute bottom-0 left-0 w-full h-[500px] bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-indigo-900/10 via-gray-900/5 to-transparent pointer-events-none -z-10"></div>
        </footer>
    )
}