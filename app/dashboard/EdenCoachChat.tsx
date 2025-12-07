'use client'

import { useState, useRef, useEffect } from 'react'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "Hey! I'm Eden. Ask me anything about your health data or what to focus on.",
}

export default function EdenCoachChat() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function handleSend(text: string) {
    if (!text.trim() || isLoading) return

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
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex'}>
            <div
              className={
                msg.role === 'user'
                  ? 'max-w-[80%] rounded-2xl rounded-br-sm bg-[#c8ff00] text-black px-4 py-3 text-[15px]'
                  : 'max-w-[80%] rounded-2xl rounded-bl-sm bg-[#1a1a1a] text-white/90 px-4 py-3 text-[15px]'
              }
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex">
            <div className="rounded-2xl rounded-bl-sm bg-[#1a1a1a] px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-white/30 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-white/10">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend(input)
          }}
          className="flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Eden..."
            disabled={isLoading}
            className="flex-1 rounded-xl bg-[#1a1a1a] border border-white/10 px-4 py-3 text-[15px] text-white placeholder:text-white/30 outline-none focus:border-white/20 transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 rounded-xl bg-[#c8ff00] text-black text-sm font-medium hover:bg-[#d4ff33] transition disabled:opacity-40"
          >
            Send
          </button>
        </form>
        <p className="mt-3 text-[11px] text-white/20 text-center">
          Eden is not a medical service. Consult a professional for health concerns.
        </p>
      </div>
    </div>
  )
}
