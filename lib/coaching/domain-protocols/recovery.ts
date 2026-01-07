/**
 * Recovery Domain Protocol Template
 * 
 * Focus: Sleep optimization, HRV improvement, stress management
 * Evidence-based approach for recovery and resilience
 */

import { DomainTemplate } from './types'

export const recoveryTemplate: DomainTemplate = {
  id: 'recovery',
  version: 1,
  name: 'Recovery',
  preview: 'Sleep optimization and HRV improvement',
  
  focusAreas: [
    'Sleep duration and quality',
    'HRV optimization',
    'Circadian rhythm alignment',
    'Active recovery practices',
  ],
  
  phases: [
    {
      number: 1,
      name: 'Assessment',
      durationWeeks: 2,
      focus: 'Establish baseline and identify sleep disruptors',
      successCriteria: 'Track sleep consistently, identify 2-3 key issues',
    },
    {
      number: 2,
      name: 'Foundation',
      durationWeeks: 4,
      focus: 'Implement core sleep hygiene practices',
      successCriteria: 'Consistent bedtime routine, reduced sleep latency',
    },
    {
      number: 3,
      name: 'Optimize',
      durationWeeks: 6,
      focus: 'Fine-tune for quality and HRV improvement',
      successCriteria: 'Improved HRV trend, consistent 7+ hours',
    },
  ],
  
  actionTemplates: [
    {
      id: 'consistent_bedtime',
      title: 'Consistent Bedtime',
      description: 'Go to bed within 30 minutes of your target time, even on weekends. Consistency is the #1 factor for sleep quality.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'evening',
      },
      targetMetric: 'sleep',
      successCriteria: 'In bed within 30 min of target time',
      phases: [1, 2, 3],
      personalizationHints: [
        'Target time based on wake time and sleep need',
        'Start with current average, gradually shift',
      ],
    },
    {
      id: 'wind_down',
      title: 'Wind-Down Routine',
      description: '30-60 minute wind-down before bed. Dim lights, no screens, relaxing activities only.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'evening',
      },
      targetMetric: 'sleep',
      fallback: 'Even 15 minutes of wind-down helps',
      phases: [2, 3],
      personalizationHints: [
        'Activities based on user preferences',
        'May include reading, stretching, meditation',
      ],
    },
    {
      id: 'morning_light',
      title: 'Morning Light Exposure',
      description: 'Get 10-30 minutes of bright light within 1 hour of waking. Outside is best, but bright indoor light works.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'morning',
      },
      targetMetric: 'sleep',
      successCriteria: 'Bright light exposure within 1 hour of waking',
      fallback: 'Light therapy lamp if outdoor access limited',
      phases: [1, 2, 3],
    },
    {
      id: 'caffeine_cutoff',
      title: 'Caffeine Cutoff',
      description: 'No caffeine after your cutoff time (typically 10-12 hours before bed). Caffeine has a 5-6 hour half-life.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'flexible',
      },
      targetMetric: 'sleep',
      phases: [1, 2, 3],
      personalizationHints: [
        'Cutoff time based on bedtime',
        'Some people more sensitive - may need earlier cutoff',
      ],
    },
    {
      id: 'screen_curfew',
      title: 'Screen Curfew',
      description: 'No phones/tablets/computers 1 hour before bed. Blue light and mental stimulation both disrupt sleep.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'evening',
      },
      targetMetric: 'sleep',
      fallback: 'If must use screens, use night mode and keep it brief',
      phases: [2, 3],
    },
    {
      id: 'track_sleep',
      title: 'Track Sleep',
      description: 'Log your sleep duration and quality. Note anything that affected it.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'morning',
      },
      targetMetric: 'sleep',
      phases: [1, 2, 3],
      prerequisites: ['Sleep tracker or manual logging'],
    },
    {
      id: 'check_hrv',
      title: 'Morning HRV Check',
      description: 'Check HRV in the morning before getting out of bed. Note the trend over time.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'morning',
      },
      targetMetric: 'hrv',
      phases: [2, 3],
      prerequisites: ['HRV-capable device (Apple Watch, Oura, Whoop, etc.)'],
    },
    {
      id: 'bedroom_environment',
      title: 'Optimize Bedroom',
      description: 'One-time task: Make bedroom dark (blackout curtains), cool (65-68°F), and quiet.',
      type: 'action',
      defaultSchedule: {
        frequency: 'once',
        targetCount: 1,
        preferredTime: 'flexible',
      },
      targetMetric: 'sleep',
      phases: [1],
    },
  ],
  
  setupQuestions: [
    {
      id: 'current_sleep',
      question: 'How many hours of sleep do you typically get?',
      type: 'single_choice',
      options: [
        { value: 'under_5', label: 'Under 5 hours' },
        { value: '5_6', label: '5-6 hours' },
        { value: '6_7', label: '6-7 hours' },
        { value: '7_8', label: '7-8 hours' },
        { value: 'over_8', label: 'Over 8 hours' },
      ],
      impactsPersonalization: 'Sets target sleep duration',
      required: true,
    },
    {
      id: 'sleep_issues',
      question: 'What sleep issues do you experience?',
      type: 'multi_choice',
      options: [
        { value: 'falling_asleep', label: 'Trouble falling asleep' },
        { value: 'staying_asleep', label: 'Waking up during the night' },
        { value: 'early_waking', label: 'Waking too early' },
        { value: 'unrefreshing', label: 'Unrefreshing sleep' },
        { value: 'none', label: 'No major issues' },
      ],
      impactsPersonalization: 'Focuses protocol on specific issues',
      required: true,
    },
    {
      id: 'bedtime',
      question: 'What time do you typically go to bed?',
      type: 'single_choice',
      options: [
        { value: 'before_9', label: 'Before 9 PM' },
        { value: '9_10', label: '9-10 PM' },
        { value: '10_11', label: '10-11 PM' },
        { value: '11_12', label: '11 PM - 12 AM' },
        { value: 'after_12', label: 'After midnight' },
      ],
      impactsPersonalization: 'Sets target bedtime and cutoff times',
      required: true,
    },
    {
      id: 'wake_time',
      question: 'What time do you need to wake up?',
      type: 'single_choice',
      options: [
        { value: 'before_5', label: 'Before 5 AM' },
        { value: '5_6', label: '5-6 AM' },
        { value: '6_7', label: '6-7 AM' },
        { value: '7_8', label: '7-8 AM' },
        { value: 'after_8', label: 'After 8 AM' },
        { value: 'variable', label: 'Varies significantly' },
      ],
      impactsPersonalization: 'Calculates sleep window',
      required: true,
    },
    {
      id: 'caffeine_intake',
      question: 'How much caffeine do you consume daily?',
      type: 'single_choice',
      options: [
        { value: 'none', label: 'None' },
        { value: 'low', label: '1 cup coffee/tea' },
        { value: 'moderate', label: '2-3 cups' },
        { value: 'high', label: '4+ cups' },
      ],
      impactsPersonalization: 'Sets caffeine cutoff recommendations',
      required: true,
    },
    {
      id: 'sleep_tracker',
      question: 'Do you use a sleep tracker?',
      type: 'single_choice',
      options: [
        { value: 'apple_watch', label: 'Apple Watch' },
        { value: 'oura', label: 'Oura Ring' },
        { value: 'whoop', label: 'Whoop' },
        { value: 'fitbit', label: 'Fitbit' },
        { value: 'other', label: 'Other device' },
        { value: 'none', label: 'No tracker' },
      ],
      impactsPersonalization: 'Determines if HRV tracking is included',
      required: true,
    },
    {
      id: 'shift_work',
      question: 'Do you work shifts or have irregular schedules?',
      type: 'boolean',
      impactsPersonalization: 'Adjusts consistency recommendations',
      required: true,
    },
  ],
  
  optionalModules: [],
  
  safety: {
    contraindications: [
      'Severe sleep apnea (requires medical treatment first)',
      'Clinical insomnia (may need CBT-I)',
      'Narcolepsy or other sleep disorders',
    ],
    beginnerIntensityCap: 'Focus on 2-3 habits at a time, not all at once',
    warningSignals: [
      'Excessive daytime sleepiness affecting function',
      'Gasping or choking during sleep (sleep apnea sign)',
      'Persistent insomnia despite good practices',
      'Sleep paralysis or vivid hallucinations',
    ],
    seekProfessionalIf: [
      'Suspected sleep apnea (snoring, gasping, daytime fatigue)',
      'Chronic insomnia not improving with hygiene',
      'Falling asleep involuntarily during the day',
      'Significant anxiety or depression affecting sleep',
    ],
  },
}

