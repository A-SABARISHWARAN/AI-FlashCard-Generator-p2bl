// js/stats.js
class StatisticsManager {
    constructor() {
        this.statsData = null;
        this.charts = {};
        this.init();
    }

    init() {
        this.loadData();
        this.renderOverview();
        this.renderCharts();
        this.renderBreakdown();
        this.renderActivity();
        this.setupEventListeners();
    }

    loadData() {
        // Load data from localStorage
        const flashcards = FlashJUtils.loadFromLocalStorage('flashj-flashcards') || [];
        const mcqs = FlashJUtils.loadFromLocalStorage('flashj-mcqs') || [];
        const quizResults = FlashJUtils.loadFromLocalStorage('flashj-quiz-results') || [];
        const leitnerBoxes = FlashJUtils.loadFromLocalStorage('flashj-leitner') || [[], [], [], [], []];
        
        // Calculate statistics
        this.statsData = this.calculateStats(flashcards, mcqs, quizResults, leitnerBoxes);
    }

    calculateStats(flashcards, mcqs, quizResults, leitnerBoxes) {
        const today = new Date();
        const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Calculate accuracy from quiz results
        const recentResults = quizResults.filter(result => 
            new Date(result.timestamp) >= oneWeekAgo
        );
        
        const accuracy = recentResults.length > 0 
            ? Math.round((recentResults.filter(r => r.isCorrect).length / recentResults.length) * 100)
            : 0;

        // Calculate streak (simplified)
        const streak = this.calculateStreak(quizResults);

        // Group by topic
        const topics = {};
        flashcards.forEach(card => {
            if (!topics[card.topic]) {
                topics[card.topic] = {
                    total: 0,
                    mastered: 0,
                    difficulty: { easy: 0, medium: 0, hard: 0 }
                };
            }
            topics[card.topic].total++;
            topics[card.topic].difficulty[card.difficulty]++;
            
            // Count mastered cards (in higher Leitner boxes)
            if (card.leitnerBox >= 3) {
                topics[card.topic].mastered++;
            }
        });

        // Leitner distribution
        const leitnerDistribution = leitnerBoxes.map(box => box.length);

        // Progress history (last 7 days)
        const progressHistory = this.generateProgressHistory(quizResults, flashcards);

        return {
            totalCards: flashcards.length,
            totalMCQs: mcqs.length,
            accuracy: accuracy,
            streak: streak,
            leitnerDistribution: leitnerDistribution,
            topics: topics,
            progressHistory: progressHistory,
            recentActivity: this.getRecentActivity(flashcards, mcqs, quizResults)
        };
    }

    calculateStreak(quizResults) {
        if (quizResults.length === 0) return 0;
        
        // Simple streak calculation based on consecutive days with activity
        const dates = [...new Set(quizResults.map(r => 
            new Date(r.timestamp).toDateString()
        ))].sort((a, b) => new Date(b) - new Date(a));
        
        let streak = 0;
        let currentDate = new Date();
        
        for (let i = 0; i < dates.length; i++) {
            const activityDate = new Date(dates[i]);
            const diffTime = currentDate - activityDate;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === i) {
                streak++;
            } else {
                break;
            }
        }
        
        return streak;
    }

    generateProgressHistory(quizResults, flashcards) {
        const history = [];
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayResults = quizResults.filter(result => 
                result.timestamp.startsWith(dateStr)
            );
            
            const accuracy = dayResults.length > 0 
                ? Math.round((dayResults.filter(r => r.isCorrect).length / dayResults.length) * 100)
                : 0;
                
            const cardsStudied = dayResults.length;
            
            history.push({
                date: dateStr,
                accuracy: accuracy,
                cardsStudied: cardsStudied,
                day: date.toLocaleDateString('en-US', { weekday: 'short' })
            });
        }
        
        return history;
    }

    getRecentActivity(flashcards, mcqs, quizResults) {
        const activities = [];
        
        // Add recent quiz results
        quizResults.slice(-5).forEach(result => {
            activities.push({
                type: 'quiz',
                title: result.isCorrect ? 'Correct Answer' : 'Incorrect Answer',
                description: result.question,
                time: result.timestamp,
                icon: result.isCorrect ? '✅' : '❌'
            });
        });
        
        // Add recent flashcard creations
        flashcards.slice(-3).forEach(card => {
            activities.push({
                type: 'flashcard',
                title: 'New Flashcard Created',
                description: card.front,
                time: card.createdAt,
                icon: '📝'
            });
        });
        
        // Add recent MCQ creations
        mcqs.slice(-2).forEach(mcq => {
            activities.push({
                type: 'mcq',
                title: 'New MCQ Created',
                description: mcq.question,
                time: mcq.createdAt,
                icon: '❓'
            });
        });
        
        // Sort by time and return latest 10
        return activities
            .sort((a, b) => new Date(b.time) - new Date(a.time))
            .slice(0, 10);
    }

    renderOverview() {
        document.getElementById('totalCards').textContent = this.statsData.totalCards;
        document.getElementById('totalMCQs').textContent = this.statsData.totalMCQs;
        document.getElementById('accuracy').textContent = `${this.statsData.accuracy}%`;
        document.getElementById('streak').textContent = this.statsData.streak;
    }

    renderCharts() {
        this.renderProgressChart();
        this.renderLeitnerChart();
        this.renderAccuracyChart();
    }

    renderProgressChart() {
        const canvas = document.getElementById('progressCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const data = this.statsData.progressHistory;
        
        // Set canvas dimensions
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        const padding = 40;
        const chartWidth = canvas.width - padding * 2;
        const chartHeight = canvas.height - padding * 2;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-light');
        ctx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(canvas.width - padding, y);
            ctx.stroke();
            
            // Y-axis labels
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary');
            ctx.font = '12px Inter';
            ctx.textAlign = 'right';
            ctx.fillText(`${100 - i * 20}%`, padding - 10, y + 4);
        }
        
        // Draw line
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary');
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        data.forEach((point, index) => {
            const x = padding + (chartWidth / (data.length - 1)) * index;
            const y = padding + chartHeight - (point.accuracy / 100) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw points and labels
        data.forEach((point, index) => {
            const x = padding + (chartWidth / (data.length - 1)) * index;
            const y = padding + chartHeight - (point.accuracy / 100) * chartHeight;
            
            // Point
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary');
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fill();
            
            // X-axis labels
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary');
            ctx.font = '12px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(point.day, x, canvas.height - padding + 20);
        });
    }

    renderLeitnerChart() {
        const canvas = document.getElementById('leitnerCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const data = this.statsData.leitnerDistribution;
        const total = data.reduce((sum, val) => sum + val, 0);
        
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 40;
        
        const colors = [
            '#ef4444', // Box 1 - red
            '#f97316', // Box 2 - orange
            '#eab308', // Box 3 - yellow
            '#22c55e', // Box 4 - green
            '#3b82f6'  // Box 5 - blue
        ];
        
        let startAngle = 0;
        
        data.forEach((value, index) => {
            if (value === 0) return;
            
            const sliceAngle = (value / total) * 2 * Math.PI;
            
            // Draw slice
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
            ctx.closePath();
            
            ctx.fillStyle = colors[index];
            ctx.fill();
            
            // Draw label
            const labelAngle = startAngle + sliceAngle / 2;
            const labelRadius = radius * 0.7;
            const labelX = centerX + Math.cos(labelAngle) * labelRadius;
            const labelY = centerY + Math.sin(labelAngle) * labelRadius;
            
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(value.toString(), labelX, labelY);
            
            startAngle += sliceAngle;
        });
        
        // Draw legend
        const legendX = 20;
        let legendY = canvas.height - data.length * 25 - 20;
        
        data.forEach((value, index) => {
            ctx.fillStyle = colors[index];
            ctx.fillRect(legendX, legendY, 15, 15);
            
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
            ctx.font = '12px Inter';
            ctx.textAlign = 'left';
            ctx.fillText(`Box ${index + 1}: ${value} cards`, legendX + 25, legendY + 12);
            
            legendY += 25;
        });
    }

    renderAccuracyChart() {
        const canvas = document.getElementById('accuracyCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const data = this.statsData.progressHistory;
        
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        const padding = 40;
        const chartWidth = canvas.width - padding * 2;
        const chartHeight = canvas.height - padding * 2;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw bars
        const barWidth = chartWidth / data.length * 0.6;
        const barSpacing = chartWidth / data.length * 0.4;
        
        data.forEach((point, index) => {
            const x = padding + (chartWidth / data.length) * index + barSpacing / 2;
            const barHeight = (point.accuracy / 100) * chartHeight;
            const y = padding + chartHeight - barHeight;
            
            // Bar
            ctx.fillStyle = point.accuracy >= 70 ? 
                getComputedStyle(document.documentElement).getPropertyValue('--accent-success') :
                point.accuracy >= 50 ?
                getComputedStyle(document.documentElement).getPropertyValue('--accent-warning') :
                getComputedStyle(document.documentElement).getPropertyValue('--accent-error');
            
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Value label
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
            ctx.font = '12px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(`${point.accuracy}%`, x + barWidth / 2, y - 10);
            
            // Day label
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary');
            ctx.fillText(point.day, x + barWidth / 2, canvas.height - padding + 20);
        });
    }

    renderBreakdown() {
        this.renderTopicsPerformance();
        this.renderRecommendations();
    }

    renderTopicsPerformance() {
        const container = document.getElementById('topicsList');
        if (!container) return;

        const topics = this.statsData.topics;
        
        if (Object.keys(topics).length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No topics data available</p>';
            return;
        }

        container.innerHTML = Object.entries(topics).map(([topic, data]) => {
            const mastery = data.total > 0 ? Math.round((data.mastered / data.total) * 100) : 0;
            const difficultyColor = this.getDifficultyColor(data.difficulty);
            
            return `
                <div class="topic-progress">
                    <div class="topic-header">
                        <span class="topic-name">${topic}</span>
                        <span class="topic-stats">${mastery}% mastery</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${mastery}%; background: ${difficultyColor};"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 0.25rem;">
                        <small style="color: var(--text-tertiary);">${data.total} cards</small>
                        <small style="color: var(--text-tertiary);">
                            E:${data.difficulty.easy} M:${data.difficulty.medium} H:${data.difficulty.hard}
                        </small>
                    </div>
                </div>
            `;
        }).join('');
    }

    getDifficultyColor(difficulty) {
        const total = difficulty.easy + difficulty.medium + difficulty.hard;
        if (total === 0) return '#6b7280';
        
        const easyRatio = difficulty.easy / total;
        const hardRatio = difficulty.hard / total;
        
        if (easyRatio > 0.7) return '#10b981'; // Green for easy
        if (hardRatio > 0.5) return '#ef4444'; // Red for hard
        return '#f59e0b'; // Orange for medium
    }

    renderRecommendations() {
        const container = document.getElementById('recommendationsList');
        if (!container) return;

        const recommendations = this.generateRecommendations();
        
        if (recommendations.length === 0) {
            container.innerHTML = `
                <div class="recommendation-item completed">
                    <div class="recommendation-header">
                        <span class="recommendation-title">Great work!</span>
                        <span class="recommendation-priority">Completed</span>
                    </div>
                    <div class="recommendation-description">
                        Keep up the consistent study habits. Consider exploring new topics.
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = recommendations.map(rec => `
            <div class="recommendation-item ${rec.priority}">
                <div class="recommendation-header">
                    <span class="recommendation-title">${rec.title}</span>
                    <span class="recommendation-priority">${rec.priority}</span>
                </div>
                <div class="recommendation-description">
                    ${rec.description}
                </div>
            </div>
        `).join('');
    }

    generateRecommendations() {
        const recommendations = [];
        const topics = this.statsData.topics;
        
        // Check for low accuracy
        if (this.statsData.accuracy < 60) {
            recommendations.push({
                title: 'Improve Accuracy',
                description: 'Your recent quiz accuracy is below 60%. Focus on reviewing difficult cards and retaking quizzes.',
                priority: 'urgent'
            });
        }
        
        // Check for topics with low mastery
        Object.entries(topics).forEach(([topic, data]) => {
            const mastery = data.total > 0 ? Math.round((data.mastered / data.total) * 100) : 0;
            
            if (mastery < 30 && data.total >= 5) {
                recommendations.push({
                    title: `Review ${topic}`,
                    description: `Only ${mastery}% of cards in "${topic}" are mastered. Schedule a focused review session.`,
                    priority: 'urgent'
                });
            } else if (mastery < 60 && data.total >= 3) {
                recommendations.push({
                    title: `Practice ${topic}`,
                    description: `Continue practicing "${topic}" to improve from ${mastery}% mastery.`,
                    priority: 'medium'
                });
            }
        });
        
        // Check study streak
        if (this.statsData.streak < 3) {
            recommendations.push({
                title: 'Build Study Habit',
                description: 'Try to study for at least 3 consecutive days to build a consistent learning habit.',
                priority: 'medium'
            });
        }
        
        return recommendations.slice(0, 3); // Limit to 3 recommendations
    }

    renderActivity() {
        const container = document.getElementById('activityTimeline');
        if (!container) return;

        const activities = this.statsData.recentActivity;
        
        if (activities.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No recent activity</p>';
            return;
        }

        container.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">${activity.icon}</div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-description" style="color: var(--text-secondary); font-size: 0.875rem; margin: 0.25rem 0;">
                        ${activity.description.length > 60 ? 
                          activity.description.substring(0, 60) + '...' : 
                          activity.description}
                    </div>
                    <div class="activity-time">
                        ${new Date(activity.time).toLocaleString()}
                    </div>
                </div>
            </div>
        `).join('');
    }

    setupEventListeners() {
        // Refresh data when page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.loadData();
                this.renderOverview();
                this.renderCharts();
                this.renderBreakdown();
                this.renderActivity();
            }
        });

        // Refresh on focus
        window.addEventListener('focus', () => {
            this.loadData();
            this.renderOverview();
            this.renderCharts();
        });
    }
}

// Initialize when page loads
if (document.getElementById('progressCanvas')) {
    const statsManager = new StatisticsManager();
    window.statsManager = statsManager;

    // Redraw charts on resize
    window.addEventListener('resize', () => {
        setTimeout(() => {
            statsManager.renderCharts();
        }, 100);
    });
}