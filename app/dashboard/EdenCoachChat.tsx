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
  content:
    "Hi, I'm Eden. I'm using your latest health metrics to help you decide what to focus on. Ask me anything about your primespan, training, sleep, or recovery.",
}

const QUICK_PROMPTS = [
  'What should I focus on this week?',
  'Explain what my metrics say about my heart and recovery.',
  "How should I adjust training if I'm traveling?",
  'Help me design a simple daily routine.',
]

export default function EdenCoachChat() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function handleSend(messageText: string) {
    if (!messageText.trim() || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/eden-coach/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          channel: 'web',
        }),
      })

      const data = await res.json()

      if (!res.ok || !data?.reply) {
        setError('Something went wrong. Please try again.')
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Sorry, something went wrong. Please try again in a moment.',
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.reply,
          },
        ])
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, there was a connection problem. Please try again.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    handleSend(input)
  }

  function handleQuickPrompt(prompt: string) {
    handleSend(prompt)
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✨</span>
          <div>
            <h3 className="text-white font-semibold">Eden Coach</h3>
            <p className="text-indigo-100 text-xs">
              Ask Eden about your current status or what to focus on this week.
            </p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="max-h-[380px] overflow-y-auto bg-white p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={msg.role === 'user' ? 'flex justify-end' : 'flex items-start gap-2'}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🧠</span>
              </div>
            )}
            <div
              className={
                msg.role === 'user'
                  ? 'rounded-2xl bg-indigo-500 text-white px-3 py-2 text-sm max-w-[80%]'
                  : 'rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-800 max-w-[80%]'
              }
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
              <span className="text-sm">🧠</span>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      {/* Quick prompts */}
      <div className="px-4 py-3 border-t border-slate-200 bg-white">
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleQuickPrompt(prompt)}
              disabled={isLoading}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-200 bg-slate-50/80 px-4 py-3"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Eden something..."
            disabled={isLoading}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-indigo-600 text-white text-sm font-medium px-4 py-2 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {isLoading ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
