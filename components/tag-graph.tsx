"use client"

import type React from "react"
import { useEffect, useRef, useMemo, useState } from "react"
import type { Note, Tag } from "@/lib/types"

interface TagGraphProps {
  notes: (Note & { tags: Tag[] })[]
  onNodeClick: (tagName: string) => void
}

interface GraphNode {
  id: string
  name: string
  x: number
  y: number
  vx: number
  vy: number
  noteCount: number
}

export function TagGraph({ notes, onNodeClick }: TagGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const nodesRef = useRef<GraphNode[]>([])

  const graphData = useMemo(() => {
    if (notes.length === 0) return { nodes: [], links: [] }

    // Create a map of tag name -> note count and tag occurrences
    const tagMap = new Map<string, { id: string; name: string; noteCount: number }>()
    const coOccurrences = new Map<string, Map<string, number>>()

    // Count tag occurrences and co-occurrences
    notes.forEach((note) => {
      const noteTags = note.tags || []

      noteTags.forEach((tag) => {
        if (!tagMap.has(tag.name)) {
          tagMap.set(tag.name, { id: tag.id, name: tag.name, noteCount: 0 })
        }
        tagMap.get(tag.name)!.noteCount++

        // Track co-occurrences with other tags
        if (!coOccurrences.has(tag.name)) {
          coOccurrences.set(tag.name, new Map())
        }

        noteTags.forEach((otherTag) => {
          if (tag.id !== otherTag.id) {
            const current = coOccurrences.get(tag.name)!.get(otherTag.name) || 0
            coOccurrences.get(tag.name)!.set(otherTag.name, current + 1)
          }
        })
      })
    })

    // Create nodes from tags
    const existingNodes = new Map(nodesRef.current.map((n) => [n.id, n]))
    const nodes: GraphNode[] = Array.from(tagMap.values()).map((tag) => {
      const existing = existingNodes.get(tag.id)
      return (
        existing || {
          id: tag.id,
          name: tag.name,
          x: Math.random() * 700 + 50,
          y: Math.random() * 500 + 50,
          vx: 0,
          vy: 0,
          noteCount: tag.noteCount,
        }
      )
    })

    nodesRef.current = nodes

    // Create links between tags that co-occur
    const links: Array<{ source: string; target: string; strength: number }> = []
    const linkSet = new Set<string>()

    coOccurrences.forEach((coTags, tagName) => {
      const sourceNode = nodes.find((n) => n.name === tagName)
      if (!sourceNode) return

      coTags.forEach((count, otherTagName) => {
        const targetNode = nodes.find((n) => n.name === otherTagName)
        if (!targetNode) return

        const linkKey = [sourceNode.id, targetNode.id].sort().join("-")
        if (!linkSet.has(linkKey)) {
          linkSet.add(linkKey)
          links.push({
            source: sourceNode.id,
            target: targetNode.id,
            strength: count,
          })
        }
      })
    })

    return { nodes, links }
  }, [notes])

  useEffect(() => {
    if (!canvasRef.current || graphData.nodes.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    canvas.style.width = rect.width + "px"
    canvas.style.height = rect.height + "px"

    const width = rect.width
    const height = rect.height
    const nodes = nodesRef.current
    const links = graphData.links

    let animationId: number

    const simulate = () => {
      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const dist = Math.hypot(dx, dy) || 1
          const force = 30 / dist

          nodes[i].vx -= (force * dx) / dist
          nodes[i].vy -= (force * dy) / dist
          nodes[j].vx += (force * dx) / dist
          nodes[j].vy += (force * dy) / dist
        }

        // Attraction along links
        for (const link of links) {
          if (link.source === nodes[i].id) {
            const target = nodes.find((n) => n.id === link.target)
            if (!target) continue

            const dx = target.x - nodes[i].x
            const dy = target.y - nodes[i].y
            const dist = Math.hypot(dx, dy) || 1
            const force = (0.005 * link.strength * dist) / 100

            nodes[i].vx += (force * dx) / dist
            nodes[i].vy += (force * dy) / dist
          } else if (link.target === nodes[i].id) {
            const target = nodes.find((n) => n.id === link.source)
            if (!target) continue

            const dx = target.x - nodes[i].x
            const dy = target.y - nodes[i].y
            const dist = Math.hypot(dx, dy) || 1
            const force = (0.005 * link.strength * dist) / 100

            nodes[i].vx += (force * dx) / dist
            nodes[i].vy += (force * dy) / dist
          }
        }

        // Damping
        nodes[i].vx *= 0.85
        nodes[i].vy *= 0.85

        // Boundary forces
        if (nodes[i].x < 50) nodes[i].vx += 1
        if (nodes[i].x > width - 50) nodes[i].vx -= 1
        if (nodes[i].y < 50) nodes[i].vy += 1
        if (nodes[i].y > height - 50) nodes[i].vy -= 1

        // Update position
        nodes[i].x += nodes[i].vx
        nodes[i].y += nodes[i].vy
      }

      // Clear canvas
      ctx.fillStyle = "rgb(255, 255, 255)"
      ctx.fillRect(0, 0, width, height)

      // Draw links
      ctx.strokeStyle = "rgba(180, 180, 180, 0.4)"
      ctx.lineWidth = 1.5
      for (const link of links) {
        const source = nodes.find((n) => n.id === link.source)
        const target = nodes.find((n) => n.id === link.target)
        if (!source || !target) continue

        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        ctx.stroke()
      }

      // Draw nodes
      for (const node of nodes) {
        ctx.fillStyle = hoveredNode === node.id ? "#333333" : "#000000"
        ctx.beginPath()
        ctx.arc(node.x, node.y, 20, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = "white"
        ctx.font = "bold 10px sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(node.name.substring(0, 6), node.x, node.y)
      }

      animationId = requestAnimationFrame(simulate)
    }

    simulate()

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [graphData, hoveredNode])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    for (const node of nodesRef.current) {
      const dx = node.x - x
      const dy = node.y - y
      const distance = Math.hypot(dx, dy)

      if (distance < 20) {
        console.log("[v0] Clicked tag:", node.name)
        onNodeClick(node.name)
        return
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    let foundNode = false
    for (const node of nodesRef.current) {
      const dx = node.x - x
      const dy = node.y - y
      if (Math.hypot(dx, dy) < 20) {
        setHoveredNode(node.id)
        canvas.style.cursor = "pointer"
        foundNode = true
        break
      }
    }

    if (!foundNode) {
      setHoveredNode(null)
      canvas.style.cursor = "default"
    }
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">No tags to visualize yet</p>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      className="w-full h-96 border border-border rounded-lg bg-background hover:shadow-md transition-shadow"
    />
  )
}
