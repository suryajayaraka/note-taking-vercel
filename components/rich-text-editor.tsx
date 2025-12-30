"use client"

import type React from "react"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Type,
  LinkIcon,
  ImageIcon,
  Upload,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)
  const isUpdatingRef = useRef(false)
  const supabase = createClient()

  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      if (editorRef.current.innerHTML !== value) {
        const selection = window.getSelection()
        const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
        const cursorPosition = range ? range.startOffset : 0
        const cursorNode = range ? range.startContainer : null

        editorRef.current.innerHTML = value

        if (cursorNode && editorRef.current.contains(cursorNode)) {
          try {
            const newRange = document.createRange()
            newRange.setStart(cursorNode, Math.min(cursorPosition, cursorNode.textContent?.length || 0))
            newRange.collapse(true)
            selection?.removeAllRanges()
            selection?.addRange(newRange)
          } catch (e) {
            editorRef.current.focus()
          }
        }
      }
    }
  }, [value])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setIsCtrlPressed(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setIsCtrlPressed(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement

    if (target.tagName === "A" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      const href = target.getAttribute("href")
      if (href) {
        window.open(href, "_blank", "noopener,noreferrer")
      }
    }

    if (target.tagName === "IMG") {
      const src = target.getAttribute("src")
      if (src) {
        setSelectedImage(src)
      }
    }
  }

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }

  const handleBold = () => applyFormat("bold")
  const handleItalic = () => applyFormat("italic")
  const handleUnderline = () => applyFormat("underline")
  const handleH1 = () => applyFormat("formatBlock", "<h1>")
  const handleH2 = () => applyFormat("formatBlock", "<h2>")
  const handleH3 = () => applyFormat("formatBlock", "<h3>")
  const handleParagraph = () => applyFormat("formatBlock", "<p>") // added handleParagraph to restore normal text
  const handleBullet = () => applyFormat("insertUnorderedList")
  const handleNumbered = () => applyFormat("insertOrderedList")

  const handleLink = () => {
    const selection = window.getSelection()
    const selectedText = selection?.toString().trim()

    if (selectedText) {
      const url = prompt("Enter URL (include https://):")
      if (url) {
        const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: hsl(var(--primary)); text-decoration: underline; cursor: pointer;">${selectedText}</a>`
        document.execCommand("insertHTML", false, linkHtml)
        editorRef.current?.focus()
        handleInput()
      }
    } else {
      const linkText = prompt("Enter link text:")
      if (linkText) {
        const url = prompt("Enter URL (include https://):")
        if (url) {
          const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: hsl(var(--primary)); text-decoration: underline; cursor: pointer;">${linkText}</a>&nbsp;`
          document.execCommand("insertHTML", false, linkHtml)
          editorRef.current?.focus()
          handleInput()
        }
      }
    }
  }

  const handleImageUrl = () => {
    const url = prompt("Enter image URL:")
    if (url) {
      const imageId = `img-${Date.now()}`
      const imgHtml = `<div class="image-container" data-image-id="${imageId}" style="position: relative; display: inline-block; margin: 1em 0;">
        <img src="${url}" alt="Image" style="max-width: 200px; height: auto; border-radius: 8px; cursor: pointer;" class="thumbnail-image" />
        <button class="delete-image-btn" data-image-id="${imageId}" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">×</button>
      </div>`
      document.execCommand("insertHTML", false, imgHtml)
      editorRef.current?.focus()
      handleInput()
    }
  }

  const handleImageUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file")
      return
    }

    setIsUploading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const fileName = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`

      const { data, error } = await supabase.storage.from("note-images").upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      })

      if (error) {
        if (error.message.includes("Bucket not found")) {
          throw new Error("Storage bucket 'note-images' not found. Please contact admin to set up storage.")
        }
        throw error
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("note-images").getPublicUrl(data.path)

      const imageId = `img-${Date.now()}`
      const imgHtml = `<div class="image-container" data-image-id="${imageId}" style="position: relative; display: inline-block; margin: 1em 0;">
        <img src="${publicUrl}" alt="${file.name}" style="max-width: 200px; height: auto; border-radius: 8px; cursor: pointer;" class="thumbnail-image" />
        <button class="delete-image-btn" data-image-id="${imageId}" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">×</button>
      </div>`
      document.execCommand("insertHTML", false, imgHtml)
      editorRef.current?.focus()

      handleInput()

      alert("Image uploaded successfully!")
    } catch (err: any) {
      console.error("[v0] Failed to upload image:", err)
      alert(`Failed to upload image: ${err.message}`)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  useEffect(() => {
    const handleDeleteClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains("delete-image-btn")) {
        e.preventDefault()
        e.stopPropagation()
        const imageId = target.getAttribute("data-image-id")
        const container = editorRef.current?.querySelector(`[data-image-id="${imageId}"]`)
        if (container) {
          container.remove()
          handleInput()
        }
      }
    }

    const editor = editorRef.current
    if (editor) {
      editor.addEventListener("click", handleDeleteClick as any)
      return () => {
        editor.removeEventListener("click", handleDeleteClick as any)
      }
    }
  }, [])

  const handleInput = () => {
    if (editorRef.current) {
      isUpdatingRef.current = true
      onChange(editorRef.current.innerHTML)
      setTimeout(() => {
        isUpdatingRef.current = false
      }, 100)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border px-2 md:px-4 py-2 flex items-center gap-1 overflow-x-auto flex-wrap md:flex-nowrap">
        <Button variant="ghost" size="icon" onClick={handleBold} title="Bold" className="h-8 w-8 md:h-10 md:w-10">
          <Bold className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleItalic} title="Italic" className="h-8 w-8 md:h-10 md:w-10">
          <Italic className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleUnderline}
          title="Underline"
          className="h-8 w-8 md:h-10 md:w-10"
        >
          <Underline className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1 hidden md:block" />

        <Button variant="ghost" size="icon" onClick={handleH1} title="Heading 1" className="h-8 w-8 md:h-10 md:w-10">
          <Heading1 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleH2} title="Heading 2" className="h-8 w-8 md:h-10 md:w-10">
          <Heading2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleH3} title="Heading 3" className="h-8 w-8 md:h-10 md:w-10">
          <Heading3 className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1 hidden md:block" />

        <Button
          variant="ghost"
          size="icon"
          onClick={handleParagraph}
          title="Normal Text"
          className="h-8 w-8 md:h-10 md:w-10"
        >
          <Type className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1 hidden md:block" />

        <Button
          variant="ghost"
          size="icon"
          onClick={handleBullet}
          title="Bullet List"
          className="h-8 w-8 md:h-10 md:w-10"
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNumbered}
          title="Numbered List"
          className="h-8 w-8 md:h-10 md:w-10"
        >
          <ListOrdered className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1 hidden md:block" />

        <Button
          variant="ghost"
          size="icon"
          onClick={handleLink}
          title="Insert Link (Ctrl+Click to open)"
          className="h-8 w-8 md:h-10 md:w-10"
        >
          <LinkIcon className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleImageUrl}
          title="Insert Image URL"
          className="h-8 w-8 md:h-10 md:w-10"
        >
          <ImageIcon className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleImageUpload}
          title="Upload Image"
          disabled={isUploading}
          className="h-8 w-8 md:h-10 md:w-10"
        >
          <Upload className="w-4 h-4" />
        </Button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onClick={handleEditorClick}
        className={`flex-1 p-4 md:p-6 overflow-auto bg-background text-foreground placeholder-muted-foreground focus-visible:outline-none focus-visible:ring-0 font-sans text-base leading-relaxed prose prose-sm md:prose-base max-w-none ${isCtrlPressed ? "ctrl-pressed" : ""}`}
        style={{
          minHeight: "200px",
        }}
        data-placeholder={placeholder || "Start typing your note..."}
      />

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={selectedImage || "/placeholder.svg"}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
        [contenteditable] h1 {
          font-size: 2em;
          font-weight: bold;
          margin: 0.67em 0;
        }
        [contenteditable] h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0.75em 0;
        }
        [contenteditable] h3 {
          font-size: 1.17em;
          font-weight: bold;
          margin: 0.83em 0;
        }
        [contenteditable] p {
          margin: 1em 0;
        }
        [contenteditable] a {
          color: hsl(var(--primary));
          text-decoration: underline;
          cursor: text;
        }
        [contenteditable].ctrl-pressed a:hover {
          cursor: pointer;
        }
        [contenteditable] a:hover {
          opacity: 0.8;
        }
        [contenteditable] ul {
          list-style-type: disc;
          display: block;
          padding-left: 40px;
          margin: 1em 0;
        }
        [contenteditable] ol {
          list-style-type: decimal;
          display: block;
          padding-left: 40px;
          margin: 1em 0;
        }
        [contenteditable] li {
          display: list-item;
          margin: 0.5em 0;
        }
        [contenteditable] .image-container {
          position: relative;
          display: inline-block;
          margin: 1em 0;
        }
        [contenteditable] .image-container:hover .delete-image-btn {
          opacity: 1;
        }
        [contenteditable] .delete-image-btn {
          opacity: 0;
          transition: opacity 0.2s;
        }
        [contenteditable] .thumbnail-image {
          max-width: 200px;
          height: auto;
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.2s;
        }
        [contenteditable] .thumbnail-image:hover {
          transform: scale(1.05);
        }
      `}</style>
    </div>
  )
}
