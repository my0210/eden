'use client'

import { useState, useRef, useEffect } from 'react'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

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

export default function EdenCoachChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasLoadedHistory = useRef(false)
  const isSendingRef = useRef(false) // Prevent double-sends

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
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: welcomeData.message
          }])
        } else {
          // Fallback if welcome endpoint fails
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: "Welcome to Eden! I'm your primespan coach. What would you like to focus on today?"
          }])
        }
      } catch (err) {
        console.error('Failed to load chat:', err)
        // Fallback message
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: "Welcome to Eden! I'm your primespan coach. What would you like to focus on today?"
        }])
      } finally {
        setIsLoadingHistory(false)
      }
    }

    loadHistory()
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function handleSend(text: string) {
    // Triple protection against double-sends
    if (!text.trim() || isLoading || isSendingRef.current) return
    
    // Lock immediately with ref (sync, no race condition)
    isSendingRef.current = true

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
        },
      ])
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
            {messages.map((msg) => (
              <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex'}>
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

      {/* Input - iMessage style */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-[#C6C6C8]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend(input)
          }}
          className="flex items-center gap-2"
        >
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
