// js/mcq-generator.js
class MCQGenerator {
    constructor() {
        this.mcqs = [];
        this.currentInput = '';
        this.quizResults = [];
        this.quizInProgress = false;
        this.currentQuiz = [];
        this.currentQuestionIndex = 0;
        this.quizScore = 0;
        this.init();
    }

    init() {
        this.loadSavedData();
        this.setupEventListeners();
        this.renderMCQs();
        this.updateStats();
    }

    loadSavedData() {
        const savedMCQs = FlashJUtils.loadFromLocalStorage('flashj-mcqs');
        const savedResults = FlashJUtils.loadFromLocalStorage('flashj-quiz-results');
        
        if (savedMCQs) this.mcqs = savedMCQs;
        if (savedResults) this.quizResults = savedResults;
    }

    setupEventListeners() {
        // Text input
        const textInput = document.getElementById('textInput');
        if (textInput) {
            textInput.addEventListener('input', FlashJUtils.debounce(() => {
                this.currentInput = textInput.value;
            }, 300));
        }

        // Generate button
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateMCQs());
        }

        // File upload
        const fileUpload = document.getElementById('fileUpload');
        if (fileUpload) {
            fileUpload.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // Drag and drop
        const dropZone = document.getElementById('dropZone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                this.handleFileDrop(e.dataTransfer.files);
            });

            dropZone.addEventListener('click', () => {
                fileUpload.click();
            });
        }

        // Question count slider
        const questionCount = document.getElementById('questionCount');
        const questionCountDisplay = document.getElementById('questionCountDisplay');
        if (questionCount && questionCountDisplay) {
            questionCount.addEventListener('input', () => {
                questionCountDisplay.textContent = `${questionCount.value} questions`;
            });
        }

        // Export button
        const exportJsonBtn = document.getElementById('exportJsonBtn');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => this.exportJSON());
        }

        // Quiz mode button
        const quizModeBtn = document.getElementById('quizModeBtn');
        if (quizModeBtn) {
            quizModeBtn.addEventListener('click', () => this.startQuizMode());
        }
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        await this.processFile(file);
    }

    async handleFileDrop(files) {
        if (files.length === 0) return;
        await this.processFile(files[0]);
    }

    async processFile(file) {
        try {
            FlashJUtils.showToast(`Processing ${file.name}...`, 'info');
            
            let text;
            if (file.type === 'application/pdf') {
                text = await FlashJUtils.extractTextFromPDF(file);
            } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
                text = await FlashJUtils.readFileAsText(file);
            } else {
                throw new Error('Unsupported file type. Please upload .txt or .pdf files.');
            }

            document.getElementById('textInput').value = text;
            this.currentInput = text;
            FlashJUtils.showToast('File processed successfully!', 'success');
            
        } catch (error) {
            console.error('Error processing file:', error);
            FlashJUtils.showToast(error.message, 'error');
        }
    }

    generateMCQs() {
        if (!this.currentInput.trim()) {
            FlashJUtils.showToast('Please enter some text or upload a file.', 'warning');
            return;
        }

        const difficulty = document.getElementById('difficultySelect').value;
        const questionCount = parseInt(document.getElementById('questionCount').value);

        FlashJUtils.showToast('Generating MCQs...', 'info');
        
        setTimeout(() => {
            const newMCQs = this.processText(this.currentInput, difficulty, questionCount);
            this.mcqs = [...this.mcqs, ...newMCQs];
            this.saveData();
            this.renderMCQs();
            this.updateStats();
            FlashJUtils.showToast(`Generated ${newMCQs.length} MCQs!`, 'success');
        }, 1500);
    }

    processText(text, difficulty, count) {
        const normalizedText = text
            .replace(/\r\n/g, '\n')
            .replace(/\n+/g, '\n')
            .trim();

        const sentences = this.extractDeclarativeSentences(normalizedText);
        const mcqs = [];

        for (let i = 0; i < Math.min(sentences.length, count); i++) {
            const sentence = sentences[i];
            const mcq = this.createMCQ(sentence, difficulty, i);
            if (mcq) {
                mcqs.push(mcq);
            }
        }

        return mcqs;
    }

    extractDeclarativeSentences(text) {
        // Improved sentence extraction focusing on factual statements
        const sentences = text.split(/[.!?]+/).filter(sentence => {
            const trimmed = sentence.trim();
            return trimmed.length > 20 && 
                   trimmed.length < 150 && 
                   !trimmed.startsWith('"') &&
                   this.isDeclarative(trimmed);
        });

        return sentences.slice(0, 15); // Limit for processing
    }

    isDeclarative(sentence) {
        // Check if sentence is declarative (not question, not command)
        const lower = sentence.toLowerCase();
        return !lower.startsWith('how') &&
               !lower.startsWith('what') &&
               !lower.startsWith('why') &&
               !lower.startsWith('when') &&
               !lower.startsWith('where') &&
               !lower.startsWith('who') &&
               !lower.startsWith('can you') &&
               !lower.startsWith('please') &&
               !lower.endsWith('?');
    }

    createMCQ(sentence, difficulty, index) {
        const entities = this.extractEntities(sentence);
        if (entities.length < 2) return null;

        // Choose target entity to blank out
        const targetIndex = Math.floor(Math.random() * entities.length);
        const targetEntity = entities[targetIndex];
        
        // Generate question by blanking out the target entity
        const question = this.generateQuestion(sentence, targetEntity);
        const correctAnswer = targetEntity;
        
        // Generate distractors based on difficulty
        const distractors = this.generateDistractors(entities, targetEntity, difficulty, sentence);

        if (distractors.length < 3) return null;

        return {
            id: FlashJUtils.generateId(),
            question: question,
            options: this.shuffleArray([correctAnswer, ...distractors]),
            correctAnswer: 0, // Will be updated after shuffling
            explanation: sentence,
            difficulty: difficulty,
            topic: `Topic ${Math.floor(index / 3) + 1}`,
            createdAt: new Date().toISOString()
        };
    }

    extractEntities(sentence) {
        // Extract potential answer entities (nouns, named entities)
        const words = sentence.split(/\s+/);
        const entities = [];
        
        // Simple noun phrase extraction (in production, use proper NLP)
        const nounPatterns = [
            /(\b[A-Z][a-z]+ [A-Z][a-z]+\b)/g, // Proper nouns
            /(\b[a-z]+ [a-z]+ [a-z]+\b)/g,    // Three-word phrases
            /(\b[a-z]+ [a-z]+\b)/g,           // Two-word phrases
            /(\b[A-Z][a-z]+\b)/g              // Capitalized words
        ];

        nounPatterns.forEach(pattern => {
            const matches = sentence.match(pattern);
            if (matches) {
                entities.push(...matches.filter(ent => ent.length > 3));
            }
        });

        // Remove duplicates and filter
        return [...new Set(entities)]
            .filter(ent => ent.length > 3 && ent.length < 30)
            .slice(0, 8);
    }

    generateQuestion(sentence, targetEntity) {
        // Create question by replacing target entity with blank
        const questionBase = sentence.replace(targetEntity, '__________');
        
        // Add question mark and format
        return `What best fits in the blank: "${questionBase}"?`;
    }

    generateDistractors(entities, correctAnswer, difficulty, originalSentence) {
        const distractors = [];
        const usedEntities = new Set([correctAnswer]);

        // Different strategies based on difficulty
        const strategies = {
            easy: this.generateEasyDistractors.bind(this),
            medium: this.generateMediumDistractors.bind(this),
            hard: this.generateHardDistractors.bind(this)
        };

        const strategy = strategies[difficulty] || strategies.medium;
        return strategy(entities, correctAnswer, usedEntities, originalSentence);
    }

    generateEasyDistractors(entities, correctAnswer, usedEntities, originalSentence) {
        const distractors = [];
        
        // Easy: completely unrelated but plausible-sounding answers
        const easyDistractors = [
            'different approach', 'alternative method', 'various techniques',
            'multiple ways', 'other means', 'diverse strategies'
        ];

        while (distractors.length < 3 && easyDistractors.length > 0) {
            const distractor = easyDistractors.shift();
            if (!usedEntities.has(distractor)) {
                distractors.push(distractor);
                usedEntities.add(distractor);
            }
        }

        return distractors;
    }

    generateMediumDistractors(entities, correctAnswer, usedEntities, originalSentence) {
        const distractors = [];
        
        // Medium: related concepts from the same domain
        for (let entity of entities) {
            if (distractors.length >= 3) break;
            if (!usedEntities.has(entity) && entity !== correctAnswer) {
                distractors.push(entity);
                usedEntities.add(entity);
            }
        }

        // Fill remaining slots with generic distractors
        const generic = ['the process', 'the system', 'the method'];
        while (distractors.length < 3 && generic.length > 0) {
            const distractor = generic.shift();
            if (!usedEntities.has(distractor)) {
                distractors.push(distractor);
                usedEntities.add(distractor);
            }
        }

        return distractors;
    }

    generateHardDistractors(entities, correctAnswer, usedEntities, originalSentence) {
        const distractors = [];
        
        // Hard: very similar concepts, might require careful reading
        const similarWords = this.findSimilarWords(correctAnswer, entities);
        
        for (let word of similarWords) {
            if (distractors.length >= 3) break;
            if (!usedEntities.has(word)) {
                distractors.push(word);
                usedEntities.add(word);
            }
        }

        // Use other entities from the sentence
        for (let entity of entities) {
            if (distractors.length >= 3) break;
            if (!usedEntities.has(entity) && entity !== correctAnswer) {
                distractors.push(entity);
                usedEntities.add(entity);
            }
        }

        return distractors;
    }

    findSimilarWords(target, entities) {
        // Find words similar to target (simple string similarity)
        const similar = [];
        const targetWords = target.toLowerCase().split(' ');
        
        for (let entity of entities) {
            if (entity === target) continue;
            
            const entityWords = entity.toLowerCase().split(' ');
            let similarity = 0;
            
            // Simple word overlap check
            for (let tw of targetWords) {
                for (let ew of entityWords) {
                    if (ew.includes(tw) || tw.includes(ew)) {
                        similarity++;
                        break;
                    }
                }
            }
            
            if (similarity > 0) {
                similar.push(entity);
            }
        }
        
        return similar;
    }

    shuffleArray(array) {
        // Fisher-Yates shuffle
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    renderMCQs() {
        const container = document.getElementById('mcqContainer');
        if (!container) return;

        if (this.mcqs.length === 0) {
            container.innerHTML = `
                <div class="text-center" style="padding: 3rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">❓</div>
                    <h3>No MCQs yet</h3>
                    <p>Generate your first set of questions by entering text above!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.mcqs.map((mcq, index) => `
            <div class="mcq-item glass" style="padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 2rem;">
                <div class="mcq-header" style="display: flex; justify-content: between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <h4 style="margin: 0 0 0.5rem 0;">${mcq.question}</h4>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <span class="badge">${mcq.topic}</span>
                            <span class="badge badge-${mcq.difficulty}">${mcq.difficulty}</span>
                        </div>
                    </div>
                    <div class="mcq-actions" style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-outline" onclick="mcqGenerator.editMCQ('${mcq.id}')">Edit</button>
                        <button class="btn btn-outline" onclick="mcqGenerator.deleteMCQ('${mcq.id}')">Delete</button>
                    </div>
                </div>
                
                <div class="mcq-options" style="margin-bottom: 1rem;">
                    ${mcq.options.map((option, optIndex) => `
                        <div class="mcq-option-preview" style="padding: 0.75rem; margin: 0.5rem 0; background: var(--bg-secondary); border-radius: 0.5rem; border-left: 4px solid ${optIndex === 0 ? 'var(--accent-success)' : 'transparent'}">
                            ${String.fromCharCode(65 + optIndex)}) ${option}
                            ${optIndex === 0 ? '<span class="badge badge-success" style="margin-left: 0.5rem;">Correct</span>' : ''}
                        </div>
                    `).join('')}
                </div>
                
                <div class="mcq-explanation" style="font-size: 0.875rem; color: var(--text-secondary);">
                    <strong>Explanation:</strong> ${mcq.explanation}
                </div>
            </div>
        `).join('');
    }

    editMCQ(mcqId) {
        const mcq = this.mcqs.find(m => m.id === mcqId);
        if (!mcq) return;

        // Simple inline editing
        const newQuestion = prompt('Edit question:', mcq.question);
        if (newQuestion) {
            mcq.question = newQuestion;
            
            // Allow editing options
            let newOptions = [];
            for (let i = 0; i < mcq.options.length; i++) {
                const newOption = prompt(`Edit option ${String.fromCharCode(65 + i)}:`, mcq.options[i]);
                if (newOption) {
                    newOptions.push(newOption);
                } else {
                    newOptions.push(mcq.options[i]);
                }
            }
            
            mcq.options = newOptions;
            this.saveData();
            this.renderMCQs();
            FlashJUtils.showToast('MCQ updated!', 'success');
        }
    }

    deleteMCQ(mcqId) {
        if (confirm('Are you sure you want to delete this MCQ?')) {
            this.mcqs = this.mcqs.filter(m => m.id !== mcqId);
            this.saveData();
            this.renderMCQs();
            this.updateStats();
            FlashJUtils.showToast('MCQ deleted!', 'success');
        }
    }

    startQuizMode() {
        if (this.mcqs.length === 0) {
            FlashJUtils.showToast('No MCQs available for quiz!', 'warning');
            return;
        }

        this.quizInProgress = true;
        this.currentQuiz = [...this.mcqs].sort(() => Math.random() - 0.5).slice(0, 5);
        this.currentQuestionIndex = 0;
        this.quizScore = 0;
        
        this.showQuizModal();
    }

    showQuizModal() {
        const modal = document.createElement('div');
        modal.className = 'quiz-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;

        this.updateQuizModal(modal);
        document.body.appendChild(modal);
    }

    updateQuizModal(modal) {
        if (this.currentQuestionIndex >= this.currentQuiz.length) {
            this.endQuiz(modal);
            return;
        }

        const currentQ = this.currentQuiz[this.currentQuestionIndex];
        
        modal.innerHTML = `
            <div class="quiz-content glass" style="padding: 2rem; border-radius: 1rem; max-width: 600px; width: 90%;">
                <div class="quiz-header" style="display: flex; justify-content: between; align-items: center; margin-bottom: 1.5rem;">
                    <h3>Quiz Mode</h3>
                    <div class="quiz-progress">
                        Question ${this.currentQuestionIndex + 1} of ${this.currentQuiz.length}
                    </div>
                </div>
                
                <div class="progress-bar" style="margin: 1rem 0;">
                    <div class="progress-fill" style="width: ${((this.currentQuestionIndex) / this.currentQuiz.length) * 100}%"></div>
                </div>
                
                <div class="quiz-question" style="margin-bottom: 2rem;">
                    <h4>${currentQ.question}</h4>
                </div>
                
                <div class="quiz-options">
                    ${currentQ.options.map((option, index) => `
                        <div class="mcq-option quiz-option" onclick="mcqGenerator.selectAnswer(${index})">
                            ${String.fromCharCode(65 + index)}) ${option}
                        </div>
                    `).join('')}
                </div>
                
                <div style="margin-top: 2rem; text-align: center;">
                    <button class="btn btn-outline" onclick="mcqGenerator.endQuiz(this.closest('.quiz-modal'))">Exit Quiz</button>
                </div>
            </div>
        `;
    }

    selectAnswer(selectedIndex) {
        const currentQ = this.currentQuiz[this.currentQuestionIndex];
        const isCorrect = selectedIndex === 0; // Since we store correct answer as first option
        
        // Record result
        this.quizResults.push({
            mcqId: currentQ.id,
            question: currentQ.question,
            selectedAnswer: selectedIndex,
            isCorrect: isCorrect,
            timestamp: new Date().toISOString()
        });

        if (isCorrect) {
            this.quizScore++;
            FlashJUtils.showToast('Correct! 🎉', 'success');
        } else {
            FlashJUtils.showToast(`Incorrect. The correct answer was: ${currentQ.options[0]}`, 'error');
        }

        this.currentQuestionIndex++;
        
        // Update modal for next question or end quiz
        const modal = document.querySelector('.quiz-modal');
        if (modal) {
            setTimeout(() => {
                this.updateQuizModal(modal);
            }, 1500);
        }
    }

    endQuiz(modal) {
        const percentage = Math.round((this.quizScore / this.currentQuiz.length) * 100);
        
        modal.innerHTML = `
            <div class="quiz-content glass" style="padding: 2rem; border-radius: 1rem; max-width: 500px; width: 90%; text-align: center;">
                <h3>Quiz Complete! 🎉</h3>
                <div style="font-size: 3rem; margin: 1rem 0;">${this.getScoreEmoji(percentage)}</div>
                <h2 style="margin: 1rem 0;">${this.quizScore}/${this.currentQuiz.length} (${percentage}%)</h2>
                
                <div style="margin: 2rem 0;">
                    <p>${this.getScoreMessage(percentage)}</p>
                </div>
                
                <div class="quiz-actions" style="display: flex; gap: 1rem; justify-content: center;">
                    <button class="btn btn-primary" onclick="mcqGenerator.restartQuiz()">Try Again</button>
                    <button class="btn btn-outline" onclick="this.closest('.quiz-modal').remove(); mcqGenerator.quizInProgress = false;">Close</button>
                </div>
            </div>
        `;

        this.saveData();
    }

    getScoreEmoji(percentage) {
        if (percentage >= 90) return '🏆';
        if (percentage >= 75) return '🎯';
        if (percentage >= 60) return '👍';
        return '📚';
    }

    getScoreMessage(percentage) {
        if (percentage >= 90) return 'Excellent! You have mastered this material.';
        if (percentage >= 75) return 'Great job! You have a good understanding.';
        if (percentage >= 60) return 'Good effort! Review the material and try again.';
        return 'Keep practicing! Review the flashcards and try again.';
    }

    restartQuiz() {
        this.quizInProgress = false;
        const modal = document.querySelector('.quiz-modal');
        if (modal) modal.remove();
        this.startQuizMode();
    }

    exportJSON() {
        if (this.mcqs.length === 0) {
            FlashJUtils.showToast('No MCQs to export!', 'warning');
            return;
        }

        const exportData = {
            mcqs: this.mcqs,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };

        FlashJUtils.downloadJSON(exportData, `flashj-mcqs-${Date.now()}.json`);
        FlashJUtils.showToast('MCQs exported as JSON!', 'success');
    }

    updateStats() {
        const stats = {
            totalMCQs: this.mcqs.length,
            byDifficulty: this.groupByDifficulty(),
            averageScore: this.calculateAverageScore(),
            quizzesTaken: this.quizResults.length
        };

        const statsElement = document.getElementById('mcqStats');
        if (statsElement) {
            statsElement.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div class="stat-card text-center">
                        <div class="stat-number">${stats.totalMCQs}</div>
                        <div class="stat-label">Total MCQs</div>
                    </div>
                    <div class="stat-card text-center">
                        <div class="stat-number">${stats.quizzesTaken}</div>
                        <div class="stat-label">Quizzes Taken</div>
                    </div>
                    <div class="stat-card text-center">
                        <div class="stat-number">${stats.averageScore}%</div>
                        <div class="stat-label">Avg Score</div>
                    </div>
                    <div class="stat-card text-center">
                        <div class="stat-number">${stats.byDifficulty.easy}</div>
                        <div class="stat-label">Easy</div>
                    </div>
                </div>
            `;
        }
    }

    groupByDifficulty() {
        const groups = { easy: 0, medium: 0, hard: 0 };
        this.mcqs.forEach(mcq => {
            groups[mcq.difficulty] = (groups[mcq.difficulty] || 0) + 1;
        });
        return groups;
    }

    calculateAverageScore() {
        if (this.quizResults.length === 0) return 0;
        
        const correctAnswers = this.quizResults.filter(r => r.isCorrect).length;
        return Math.round((correctAnswers / this.quizResults.length) * 100);
    }

    saveData() {
        FlashJUtils.saveToLocalStorage('flashj-mcqs', this.mcqs);
        FlashJUtils.saveToLocalStorage('flashj-quiz-results', this.quizResults);
    }
}

// Initialize when page loads
if (document.getElementById('mcqContainer')) {
    const mcqGenerator = new MCQGenerator();
    window.mcqGenerator = mcqGenerator;
}