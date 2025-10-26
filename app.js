// js/app.js
class FlashJApp {
    constructor() {
        this.currentPage = 'home';
        this.demoData = null;
        this.init();
    }

    async init() {
        await this.loadDemoData();
        this.setupEventListeners();
        this.initializeDemoContent();
    }

    async loadDemoData() {
        try {
            // Load demo data from local JSON file
            const response = await fetch('./data/demo-data.json');
            this.demoData = await response.json();
        } catch (error) {
            console.error('Error loading demo data:', error);
            // Fallback demo data
            this.demoData = this.getFallbackDemoData();
        }
    }

    getFallbackDemoData() {
        return {
            flashcards: [
                {
                    id: '1',
                    topic: 'Learning Systems',
                    front: 'What is the Leitner system?',
                    back: 'A spaced repetition technique that sorts flashcards into boxes by mastery; difficult cards are reviewed more frequently to improve retention.',
                    notes: 'Based on the spacing effect in cognitive psychology',
                    tags: ['spaced-repetition', 'memory'],
                    difficulty: 'medium'
                },
                {
                    id: '2',
                    topic: 'Learning Systems',
                    front: 'How does spaced repetition work?',
                    back: 'Spaced repetition increases intervals between reviews of learned material to take advantage of the psychological spacing effect for better long-term retention.',
                    notes: 'First proposed by Hermann Ebbinghaus',
                    tags: ['memory', 'learning'],
                    difficulty: 'easy'
                }
            ],
            mcqs: [
                {
                    id: '1',
                    question: 'What does the Leitner system help improve?',
                    options: [
                        'Memory retention',
                        'Battery life',
                        'File compression',
                        'Screen resolution'
                    ],
                    correctAnswer: 0,
                    explanation: 'The Leitner system is specifically designed to improve memory retention through spaced repetition.',
                    difficulty: 'easy',
                    topic: 'Learning Systems'
                }
            ],
            stats: {
                totalCards: 45,
                totalMCQs: 23,
                accuracy: 78,
                streak: 7,
                leitnerBoxes: {
                    box1: 15,
                    box2: 12,
                    box3: 8,
                    box4: 6,
                    box5: 4
                }
            }
        };
    }

    setupEventListeners() {
        // Demo button
        const demoBtn = document.getElementById('demoBtn');
        if (demoBtn) {
            demoBtn.addEventListener('click', () => this.showDemo());
        }

        // Navigation
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(link.getAttribute('href'));
            });
        });
    }

    initializeDemoContent() {
        this.renderDemoFlashcards();
        this.renderDemoMCQ();
    }

    renderDemoFlashcards() {
        const container = document.querySelector('.flashcards-preview');
        if (!container || !this.demoData) return;

        container.innerHTML = this.demoData.flashcards.slice(0, 2).map(card => `
            <div class="flashcard" onclick="this.classList.toggle('flipped')">
                <div class="flashcard-inner">
                    <div class="flashcard-front">
                        <h4>${card.front}</h4>
                    </div>
                    <div class="flashcard-back">
                        <p>${card.back}</p>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderDemoMCQ() {
        const container = document.querySelector('.mcq-preview');
        if (!container || !this.demoData) return;

        const mcq = this.demoData.mcqs[0];
        container.innerHTML = `
            <div class="mcq-question">
                <h4>${mcq.question}</h4>
            </div>
            <div class="mcq-options">
                ${mcq.options.map((option, index) => `
                    <div class="mcq-option ${index === mcq.correctAnswer ? 'correct' : ''}">
                        ${String.fromCharCode(65 + index)}) ${option}
                    </div>
                `).join('')}
            </div>
        `;
    }

    showDemo() {
        FlashJUtils.showToast('Loading demo content...', 'info');
        
        // Simulate loading and show more detailed demo
        setTimeout(() => {
            const demoContent = document.createElement('div');
            demoContent.className = 'demo-expanded';
            demoContent.innerHTML = `
                <div class="glass" style="padding: 2rem; border-radius: 1rem; margin: 2rem 0;">
                    <h3>Demo Features</h3>
                    <p>This demo shows the core functionality of FlashJ:</p>
                    <ul style="margin: 1rem 0; padding-left: 1.5rem;">
                        <li>AI-powered flashcard generation from text</li>
                        <li>Multiple Choice Question creation</li>
                        <li>Spaced repetition with Leitner system</li>
                        <li>Progress tracking and analytics</li>
                    </ul>
                    <div class="hero-actions">
                        <a href="generate.html" class="btn btn-primary">Try Flashcard Generator</a>
                        <a href="mcq.html" class="btn btn-secondary">Try MCQ Generator</a>
                    </div>
                </div>
            `;
            
            const demoSection = document.querySelector('.demo-section .container');
            if (demoSection) {
                demoSection.appendChild(demoContent);
            }
        }, 1000);
    }

    navigateTo(path) {
        window.location.href = path;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FlashJApp();
});