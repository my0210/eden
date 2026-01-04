-- ============================================================================
-- Drop Habits Tables
-- ============================================================================
-- Simplify the coaching system by removing Habits.
-- Actions are sufficient for tracking user activities.
-- ============================================================================

-- Drop habit_logs first (references eden_habits)
DROP TABLE IF EXISTS eden_habit_logs CASCADE;

-- Drop habits table
DROP TABLE IF EXISTS eden_habits CASCADE;

