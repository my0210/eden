/**
 * Mind Domain Protocol Template
 * 
 * Focus: Focus training, cognitive load management, mental clarity
 * Evidence-based approach for cognitive health
 */

import { DomainTemplate } from './types'

export const mindTemplate: DomainTemplate = {
  id: 'mind',
  version: 1,
  name: 'Mind',
  preview: 'Focus training and cognitive load management',
  
  focusAreas: [
    'Sustained attention and focus',
    'Cognitive load management',
    'Digital boundaries',
    'Mental clarity practices',
  ],
  
  phases: [
    {
      number: 1,
      name: 'Awareness',
      durationWeeks: 2,
      focus: 'Notice attention patterns and digital habits',
      successCriteria: 'Identify top 3 focus disruptors',
    },
    {
      number: 2,
      name: 'Boundaries',
      durationWeeks: 4,
      focus: 'Establish digital boundaries and focus blocks',
      successCriteria: 'Regular focus blocks, reduced distractions',
    },
    {
      number: 3,
      name: 'Training',
      durationWeeks: 6,
      focus: 'Build sustained attention capacity',
      successCriteria: 'Longer focus blocks, improved clarity',
    },
  ],
  
  actionTemplates: [
    {
      id: 'morning_focus_block',
      title: 'Morning Focus Block',
      description: 'Protect 60-90 minutes each morning for deep work. No email, no meetings, no phone. Your best cognitive hours.',
      type: 'action',
      defaultSchedule: {
        frequency: '5x',
        targetCount: 5,
        suggestedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        preferredTime: 'morning',
      },
      targetMetric: 'cognition',
      successCriteria: 'Complete focus block without interruption',
      fallback: '30 minutes if full block not possible',
      phases: [2, 3],
      personalizationHints: [
        'Duration based on current capacity',
        'Time based on schedule and chronotype',
      ],
    },
    {
      id: 'phone_free_morning',
      title: 'Phone-Free First Hour',
      description: 'Don\'t check phone for first hour after waking. Protect your mental state before external inputs.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'morning',
      },
      targetMetric: 'cognition',
      fallback: 'Even 30 minutes phone-free helps',
      phases: [1, 2, 3],
    },
    {
      id: 'single_tasking',
      title: 'Single-Task Sessions',
      description: 'Work on one thing at a time. Close other tabs, silence notifications. Multitasking is a myth.',
      type: 'habit',
      defaultSchedule: {
        frequency: '3x',
        targetCount: 3,
        preferredTime: 'flexible',
      },
      targetMetric: 'cognition',
      phases: [1, 2, 3],
    },
    {
      id: 'mindfulness',
      title: 'Mindfulness Practice',
      description: '5-15 minutes of meditation or mindful breathing. Trains attention and reduces reactivity.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'morning',
      },
      targetMetric: 'cognition',
      fallback: '3 deep breaths if no time for full practice',
      phases: [2, 3],
      personalizationHints: [
        'Duration based on experience',
        'Guided vs unguided based on preference',
      ],
    },
    {
      id: 'attention_log',
      title: 'Log Focus Disruptors',
      description: 'Note what broke your focus today. Patterns reveal what to change.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'evening',
      },
      phases: [1],
    },
    {
      id: 'notification_audit',
      title: 'Notification Audit',
      description: 'Review and disable non-essential notifications. Each notification costs 23 minutes of refocus time.',
      type: 'action',
      defaultSchedule: {
        frequency: 'once',
        targetCount: 1,
        preferredTime: 'flexible',
      },
      phases: [1],
    },
    {
      id: 'email_batching',
      title: 'Batch Email/Messages',
      description: 'Check email/messages at set times only (e.g., 9am, 1pm, 5pm). Not on-demand.',
      type: 'habit',
      defaultSchedule: {
        frequency: '5x',
        targetCount: 5,
        preferredTime: 'flexible',
      },
      targetMetric: 'cognition',
      phases: [2, 3],
      personalizationHints: [
        'Batch frequency based on job requirements',
        'Can start with 4-5 checks and reduce',
      ],
    },
    {
      id: 'brain_breaks',
      title: 'Brain Breaks',
      description: 'Take a 5-10 minute break every 90 minutes. Move, rest eyes, step outside. Prevents cognitive fatigue.',
      type: 'habit',
      defaultSchedule: {
        frequency: '3x',
        targetCount: 3,
        preferredTime: 'flexible',
      },
      targetMetric: 'cognition',
      phases: [2, 3],
    },
    {
      id: 'end_of_day_shutdown',
      title: 'Shutdown Ritual',
      description: 'End workday with a clear ritual: review tasks, plan tomorrow, close loops. Creates mental separation.',
      type: 'habit',
      defaultSchedule: {
        frequency: '5x',
        targetCount: 5,
        preferredTime: 'evening',
      },
      phases: [2, 3],
    },
  ],
  
  setupQuestions: [
    {
      id: 'focus_struggles',
      question: 'What are your biggest focus challenges?',
      type: 'multi_choice',
      options: [
        { value: 'starting', label: 'Getting started on tasks' },
        { value: 'sustaining', label: 'Maintaining focus once started' },
        { value: 'distractions', label: 'Phone/notification distractions' },
        { value: 'overwhelm', label: 'Feeling overwhelmed by tasks' },
        { value: 'brain_fog', label: 'Brain fog or mental fatigue' },
        { value: 'procrastination', label: 'Procrastination' },
      ],
      impactsPersonalization: 'Focuses protocol on specific challenges',
      required: true,
    },
    {
      id: 'work_type',
      question: 'What type of work do you do?',
      type: 'single_choice',
      options: [
        { value: 'deep_work', label: 'Deep work (writing, coding, analysis)' },
        { value: 'meetings_heavy', label: 'Meeting-heavy (management, sales)' },
        { value: 'reactive', label: 'Reactive work (support, operations)' },
        { value: 'creative', label: 'Creative work (design, content)' },
        { value: 'mixed', label: 'Mixed - varies by day' },
      ],
      impactsPersonalization: 'Adjusts focus block recommendations',
      required: true,
    },
    {
      id: 'screen_time',
      question: 'Approximately how many hours per day are you on screens?',
      type: 'single_choice',
      options: [
        { value: 'low', label: 'Under 4 hours' },
        { value: 'moderate', label: '4-8 hours' },
        { value: 'high', label: '8-12 hours' },
        { value: 'very_high', label: '12+ hours' },
      ],
      impactsPersonalization: 'Sets digital boundary recommendations',
      required: true,
    },
    {
      id: 'meditation_experience',
      question: 'Have you practiced meditation before?',
      type: 'single_choice',
      options: [
        { value: 'never', label: 'Never tried' },
        { value: 'tried', label: 'Tried but didn\'t stick' },
        { value: 'occasional', label: 'Practice occasionally' },
        { value: 'regular', label: 'Regular practice' },
      ],
      impactsPersonalization: 'Adjusts mindfulness recommendations',
      required: true,
    },
    {
      id: 'control_over_schedule',
      question: 'How much control do you have over your schedule?',
      type: 'single_choice',
      options: [
        { value: 'high', label: 'High - I set my own schedule' },
        { value: 'moderate', label: 'Moderate - Some flexibility' },
        { value: 'low', label: 'Low - Schedule driven by others/work' },
      ],
      impactsPersonalization: 'Adjusts focus block recommendations',
      required: true,
    },
    {
      id: 'biggest_time_sink',
      question: 'What\'s your biggest time sink?',
      type: 'single_choice',
      options: [
        { value: 'social_media', label: 'Social media' },
        { value: 'email', label: 'Email/Slack' },
        { value: 'news', label: 'News/content consumption' },
        { value: 'meetings', label: 'Unnecessary meetings' },
        { value: 'other', label: 'Other' },
      ],
      impactsPersonalization: 'Targets specific digital habits',
      required: true,
    },
  ],
  
  optionalModules: [],
  
  safety: {
    contraindications: [
      'Severe anxiety or panic disorder (meditation may need guidance)',
      'Active depression episode (may need professional support first)',
      'ADHD without proper management strategy',
    ],
    beginnerIntensityCap: 'Start with 1-2 habits, not wholesale change',
    warningSignals: [
      'Increased anxiety from meditation',
      'Perfectionism around focus habits',
      'Guilt spirals from "failed" focus blocks',
      'Social isolation from digital boundaries',
    ],
    seekProfessionalIf: [
      'Persistent brain fog despite sleep and nutrition',
      'Inability to focus affecting work/life significantly',
      'Suspected ADHD symptoms',
      'Anxiety or depression affecting function',
    ],
  },
}

