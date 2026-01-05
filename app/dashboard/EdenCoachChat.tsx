'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  suggestions?: string[]
}

// Preset quick actions - always available
const PRESET_SUGGESTIONS = [
  { label: 'Check in with me', message: "Let's do a check-in. How am I doing on my goal?" },
  { label: 'Adjust my plan', message: "I'd like to adjust my plan. Can we talk about it?" },
  { label: 'I have news', message: "I have some updates to share with you." },
]

// Simple markdown renderer for bold text and newlines
function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

interface EdenCoachChatProps {
  initialMessage?: string
}

export default function EdenCoachChat({ initialMessage }: EdenCoachChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [hasActiveGoal, setHasActiveGoal] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasLoadedHistory = useRef(false)
  const hasSentInitialMessage = useRef(false)
  const isSendingRef = useRef(false)
  const searchParams = useSearchParams()

  // Check for pre-filled message from URL
  const urlMessage = searchParams.get('message')

  // Load conversation history on mount
  useEffect(() => {
    if (hasLoadedHistory.current) return
    hasLoadedHistory.current = true

    async function loadHistory() {
      try {
        const res = await fetch('/api/eden-coach/history')
        if (res.ok) {
          const data = await res.json()
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages)
            setIsLoadingHistory(false)
            return
          }
        }
        
        // No history - fetch the deterministic welcome message from server
        const welcomeRes = await fetch('/api/eden-coach/welcome')
        if (welcomeRes.ok) {
          const welcomeData = await welcomeRes.json()
          setHasActiveGoal(welcomeData.hasActiveGoal || false)
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: welcomeData.message,
            suggestions: welcomeData.suggestions
          }])
        } else {
          // Fallback if welcome endpoint fails
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: "Hey! I'm Eden. What would you like to work on today?"
          }])
        }
      } catch (err) {
        console.error('Failed to load chat:', err)
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: "Hey! I'm Eden. What would you like to work on today?"
        }])
      } finally {
        setIsLoadingHistory(false)
      }
    }

    loadHistory()
  }, [])

  // Handle pre-filled message from URL or prop
  useEffect(() => {
    if (hasSentInitialMessage.current) return
    if (isLoadingHistory) return

    const messageToSend = initialMessage || (urlMessage ? decodeURIComponent(urlMessage) : null)
    
    if (messageToSend && messages.length > 0) {
      hasSentInitialMessage.current = true
      // Small delay to ensure UI is ready
      setTimeout(() => {
        handleSend(messageToSend)
      }, 100)
    }
  }, [isLoadingHistory, messages.length, initialMessage, urlMessage])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function handleSend(text: string) {
    // Triple protection against double-sends
    if (!text.trim() || isLoading || isSendingRef.current) return
    
    // Lock immediately with ref (sync, no race condition)
    isSendingRef.current = true
    setShowPresets(false)

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/eden-coach/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, channel: 'web' }),
      })
      const data = await res.json()

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data?.reply || 'Sorry, something went wrong.',
          suggestions: data?.suggestions,
        },
      ])

      // Check if goal was just created
      if (data?.reply?.includes('Check the Coaching tab')) {
        setHasActiveGoal(true)
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: 'Connection error. Try again.' },
      ])
    } finally {
      setIsLoading(false)
      isSendingRef.current = false
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-[#8E8E93] rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="w-2 h-2 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div key={msg.id}>
                <div className={msg.role === 'user' ? 'flex justify-end' : 'flex'}>
                  <div
                    className={
                      msg.role === 'user'
                        ? 'max-w-[75%] rounded-2xl rounded-br-md bg-[#007AFF] text-white px-4 py-2.5'
                        : 'max-w-[75%] rounded-2xl rounded-bl-md bg-[#E5E5EA] text-black px-4 py-2.5'
                    }
                  >
                    <p className="text-[17px] leading-[22px] whitespace-pre-wrap">{renderMarkdown(msg.content)}</p>
                  </div>
                </div>
                {/* Show suggestions only for the last assistant message */}
                {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && idx === messages.length - 1 && !isLoading && (
                  <div className="flex flex-wrap gap-2 mt-2 ml-1">
                    {msg.suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(suggestion)}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-sm rounded-full border border-[#007AFF] text-[#007AFF] bg-white hover:bg-[#007AFF]/10 transition-colors disabled:opacity-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex">
                <div className="rounded-2xl rounded-bl-md bg-[#E5E5EA] px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[#8E8E93] rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <span className="w-2 h-2 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset suggestions (show when user has active goal) */}
      {hasActiveGoal && showPresets && !isLoading && (
        <div className="flex-shrink-0 px-4 pb-2 border-t border-[#E5E5EA] pt-2">
          <div className="flex flex-wrap gap-2">
            {PRESET_SUGGESTIONS.map((preset, i) => (
              <button
                key={i}
                onClick={() => handleSend(preset.message)}
                className="px-3 py-1.5 text-sm rounded-full bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA] transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input - iMessage style */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-[#C6C6C8]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend(input)
          }}
          className="flex items-center gap-2"
        >
          {/* Preset toggle button (only show when user has active goal) */}
          {hasActiveGoal && (
            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                showPresets ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#8E8E93]'
              }`}
              aria-label="Quick actions"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message"
            disabled={isLoading || isLoadingHistory}
            className="flex-1 rounded-full bg-[#F2F2F7] border border-[#C6C6C8] px-4 py-2 text-[17px] text-black placeholder:text-[#8E8E93] outline-none focus:border-[#007AFF] transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || isLoadingHistory || !input.trim()}
            className="w-9 h-9 rounded-full bg-[#007AFF] flex items-center justify-center disabled:bg-[#C7C7CC] transition-colors"
            aria-label="Send"
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
