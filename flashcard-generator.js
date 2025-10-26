// js/flashcard-generator.js
class FlashcardGenerator {
    constructor() {
        this.flashcards = [];
        this.currentInput = '';
        this.leitnerBoxes = [[], [], [], [], []];
        this.init();
    }

    init() {
        this.loadSavedData();
        this.setupEventListeners();
        this.renderFlashcards();
        this.updateStats();
    }

    loadSavedData() {
        const savedCards = FlashJUtils.loadFromLocalStorage('flashj-flashcards');
        const savedLeitner = FlashJUtils.loadFromLocalStorage('flashj-leitner');
        
        if (savedCards) this.flashcards = savedCards;
        if (savedLeitner) this.leitnerBoxes = savedLeitner;
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
            generateBtn.addEventListener('click', () => this.generateFlashcards());
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

        // Export buttons
        const exportJsonBtn = document.getElementById('exportJsonBtn');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => this.exportJSON());
        }

        const exportPdfBtn = document.getElementById('exportPdfBtn');
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => this.exportPDF());
        }

        // Study mode
        const studyModeBtn = document.getElementById('studyModeBtn');
        if (studyModeBtn) {
            studyModeBtn.addEventListener('click', () => this.startStudyMode());
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

    generateFlashcards() {
        if (!this.currentInput.trim()) {
            FlashJUtils.showToast('Please enter some text or upload a file.', 'warning');
            return;
        }

        FlashJUtils.showToast('Generating flashcards...', 'info');
        
        // Simulate processing delay
        setTimeout(() => {
            const newFlashcards = this.processText(this.currentInput);
            this.flashcards = [...this.flashcards, ...newFlashcards];
            this.saveData();
            this.renderFlashcards();
            this.updateStats();
            FlashJUtils.showToast(`Generated ${newFlashcards.length} flashcards!`, 'success');
        }, 1500);
    }

    processText(text) {
        // Clean and normalize text
        const cleanedText = this.cleanText(text);
        
        // Split into meaningful sentences
        const sentences = this.splitIntoSentences(cleanedText);
        
        // Generate flashcards from sentences
        const flashcards = [];
        
        sentences.forEach((sentence, index) => {
            if (this.isValidFlashcardSentence(sentence)) {
                const flashcard = this.createFlashcardFromSentence(sentence, index);
                if (flashcard && !this.isDuplicateCard(flashcard, flashcards)) {
                    flashcards.push(flashcard);
                }
            }
        });

        return flashcards.slice(0, 10); // Limit to 10 cards max
    }

    cleanText(text) {
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\n+/g, '\n')
            .replace(/\s+/g, ' ')
            .trim();
    }

    splitIntoSentences(text) {
        // Improved sentence splitting that handles abbreviations
        return text.split(/(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!)\s+/)
            .filter(sentence => sentence.trim().length > 0);
    }

    isValidFlashcardSentence(sentence) {
        const words = sentence.trim().split(/\s+/);
        return words.length >= 5 && 
               words.length <= 35 && 
               !sentence.includes('http') &&
               this.containsSubstantiveContent(sentence);
    }

    containsSubstantiveContent(sentence) {
        // Check if sentence contains meaningful content
        const lowerSentence = sentence.toLowerCase();
        const hasKeywords = /(system|method|process|technique|theory|concept|principle|approach|model|framework|study|research|analysis|development|implementation|definition|function|purpose|benefit|advantage|disadvantage|characteristic|feature)/.test(lowerSentence);
        const hasProperNouns = /[A-Z][a-z]+ [A-Z][a-z]+/.test(sentence);
        const hasNumbers = /\d+/.test(sentence);
        
        return hasKeywords || hasProperNouns || hasNumbers || sentence.length > 50;
    }

    createFlashcardFromSentence(sentence, index) {
        // Extract key information to create front/back
        const keywords = this.extractKeywords(sentence);
        const mainConcept = this.extractMainConcept(sentence);
        
        if (!mainConcept) return null;

        // Create flashcard with meaningful front and back
        const flashcard = {
            id: FlashJUtils.generateId(),
            topic: `Concept ${index + 1}`,
            front: this.generateFrontContent(sentence, mainConcept),
            back: this.generateBackContent(sentence),
            notes: '',
            tags: keywords.slice(0, 3),
            difficulty: this.assessDifficulty(sentence),
            createdAt: new Date().toISOString(),
            lastReviewed: null,
            leitnerBox: 0
        };

        return flashcard;
    }

    extractMainConcept(sentence) {
        // Extract the main concept or subject from the sentence
        const patterns = [
            /([A-Z][^,.!?]{10,50}?)\s+(?:is|are|was|were|refers to|means|defined as)/i,
            /(?:The|A|An)\s+([^,.!?]{10,40}?)\s+(?:is|are|was|were)/i,
            /([A-Z][^,.!?]{10,50}?)\s+(?:can|may|might|should|must)/i
        ];

        for (let pattern of patterns) {
            const match = sentence.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        // Fallback: take first meaningful phrase
        const words = sentence.split(' ');
        if (words.length > 5) {
            return words.slice(0, 4).join(' ').replace(/[.,!?;:]$/, '');
        }

        return null;
    }

    generateFrontContent(sentence, mainConcept) {
        // Create concise front content (keyword, term, or short phrase)
        if (mainConcept && mainConcept.length <= 40) {
            return mainConcept;
        }

        // Create a short summary for the front
        const words = sentence.split(' ');
        if (words.length <= 8) {
            return sentence;
        }

        // Take key phrase from beginning
        const keyPhrase = words.slice(0, 6).join(' ');
        return keyPhrase + (words.length > 6 ? '...' : '');
    }

    generateBackContent(sentence) {
        // Create detailed back content (explanation, definition, or full context)
        if (sentence.length <= 120) {
            return sentence;
        }

        // For longer sentences, create a concise version
        const clauses = sentence.split(/[,;:]|\band\b|\bor\b/);
        if (clauses.length > 1) {
            return clauses[0].trim() + '. ' + this.getMostImportantClause(clauses.slice(1));
        }

        // Simple truncation for very long sentences
        return sentence.substring(0, 150) + '...';
    }

    getMostImportantClause(clauses) {
        // Find the most important clause based on keywords
        const importantWords = ['because', 'therefore', 'however', 'although', 'while', 'since'];
        
        for (let clause of clauses) {
            const lowerClause = clause.toLowerCase();
            if (importantWords.some(word => lowerClause.includes(word)) || 
                /[A-Z][a-z]+ [A-Z][a-z]+/.test(clause) ||
                /\d+/.test(clause)) {
                return clause.trim();
            }
        }
        
        return clauses[0].trim();
    }

    extractKeywords(text) {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
            'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
            'these', 'those', 'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who', 'whom',
            'when', 'where', 'why', 'how'
        ]);

        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => 
                word.length > 3 && 
                !stopWords.has(word) &&
                !this.isCommonVerb(word)
            );

        // Count frequency and return most relevant
        const frequency = {};
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });

        return Object.entries(frequency)
            .sort(([wordA, countA], [wordB, countB]) => {
                // Prioritize longer words and higher frequency
                const scoreA = countA * wordA.length;
                const scoreB = countB * wordB.length;
                return scoreB - scoreA;
            })
            .slice(0, 5)
            .map(([word]) => word);
    }

    isCommonVerb(word) {
        const commonVerbs = new Set([
            'have', 'has', 'had', 'do', 'does', 'did', 'say', 'says', 'said', 'make', 'makes', 'made',
            'go', 'goes', 'went', 'get', 'gets', 'got', 'know', 'knows', 'known', 'see', 'sees', 'saw',
            'think', 'thinks', 'thought', 'take', 'takes', 'took', 'come', 'comes', 'came', 'look', 'looks'
        ]);
        return commonVerbs.has(word);
    }

    assessDifficulty(sentence) {
        const words = sentence.split(' ');
        const longWords = words.filter(word => word.length > 8).length;
        const ratio = longWords / words.length;
        
        if (ratio > 0.3) return 'hard';
        if (ratio > 0.15) return 'medium';
        return 'easy';
    }

    isDuplicateCard(newCard, existingCards) {
        // Check if a similar card already exists
        return existingCards.some(card => 
            card.front === newCard.front || 
            card.back === newCard.back ||
            this.calculateSimilarity(card.front, newCard.front) > 0.7
        );
    }

    calculateSimilarity(str1, str2) {
        // Simple similarity calculation
        const words1 = new Set(str1.toLowerCase().split(/\s+/));
        const words2 = new Set(str2.toLowerCase().split(/\s+/));
        
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        return intersection.size / union.size;
    }

    renderFlashcards() {
        const container = document.getElementById('flashcardsContainer');
        if (!container) return;

        if (this.flashcards.length === 0) {
            container.innerHTML = `
                <div class="text-center" style="padding: 3rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">📚</div>
                    <h3>No flashcards yet</h3>
                    <p>Generate your first set of flashcards by entering text above!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.flashcards.map(card => `
            <div class="flashcard-item glass" style="padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 1rem; border-left: 4px solid var(--accent-primary);">
                <div class="flashcard-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div style="flex: 1;">
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
                            <span class="badge" style="background: var(--bg-tertiary);">${card.topic}</span>
                            ${card.tags.map(tag => `<span class="badge badge-primary">${tag}</span>`).join('')}
                            <span class="badge badge-${card.difficulty}">${card.difficulty}</span>
                        </div>
                    </div>
                    <div class="flashcard-actions" style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-outline" onclick="flashcardGenerator.editCard('${card.id}')" style="padding: 0.5rem;">Edit</button>
                        <button class="btn btn-outline" onclick="flashcardGenerator.deleteCard('${card.id}')" style="padding: 0.5rem;">Delete</button>
                    </div>
                </div>
                
                <div class="flashcard-preview" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div style="background: var(--gradient-primary); color: white; padding: 1rem; border-radius: 0.5rem;">
                        <strong>Front:</strong>
                        <p style="margin: 0.5rem 0 0 0; line-height: 1.4;">${card.front}</p>
                    </div>
                    <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem;">
                        <strong style="color: var(--text-primary);">Back:</strong>
                        <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); line-height: 1.4;">${card.back}</p>
                    </div>
                </div>

                <div class="flashcard-interactive" style="text-align: center;">
                    <div class="flashcard" onclick="this.classList.toggle('flipped')" style="width: 100%; max-width: 400px; height: 200px; perspective: 1000px; cursor: pointer; margin: 0 auto;">
                        <div class="flashcard-inner" style="width: 100%; height: 100%; position: relative; transform-style: preserve-3d; transition: transform 0.6s ease;">
                            <div class="flashcard-front" style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: var(--gradient-primary); color: white; border-radius: 0.75rem; padding: 1.5rem; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-lg);">
                                <h4 style="margin: 0; text-align: center; line-height: 1.4;">${card.front}</h4>
                            </div>
                            <div class="flashcard-back" style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: var(--bg-primary); color: var(--text-primary); border-radius: 0.75rem; padding: 1.5rem; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-lg); border: 1px solid var(--border-light); transform: rotateY(180deg);">
                                <p style="margin: 0; text-align: center; line-height: 1.4;">${card.back}</p>
                            </div>
                        </div>
                    </div>
                    <p style="margin-top: 0.5rem; color: var(--text-tertiary); font-size: 0.875rem;">Click the card to flip</p>
                </div>
            </div>
        `).join('');
    }

    editCard(cardId) {
        const card = this.flashcards.find(c => c.id === cardId);
        if (!card) return;

        const newFront = prompt('Edit front content:', card.front);
        if (newFront !== null) {
            const newBack = prompt('Edit back content:', card.back);
            if (newBack !== null) {
                card.front = newFront;
                card.back = newBack;
                this.saveData();
                this.renderFlashcards();
                FlashJUtils.showToast('Flashcard updated!', 'success');
            }
        }
    }

    deleteCard(cardId) {
        if (confirm('Are you sure you want to delete this flashcard?')) {
            this.flashcards = this.flashcards.filter(c => c.id !== cardId);
            this.saveData();
            this.renderFlashcards();
            this.updateStats();
            FlashJUtils.showToast('Flashcard deleted!', 'success');
        }
    }

    startStudyMode() {
        if (this.flashcards.length === 0) {
            FlashJUtils.showToast('No flashcards to study!', 'warning');
            return;
        }

        this.showStudyModal();
    }

    showStudyModal() {
        const studyCards = [...this.flashcards].sort(() => Math.random() - 0.5);
        let currentIndex = 0;
        let knownCards = 0;

        const modal = document.createElement('div');
        modal.className = 'study-modal';
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

        this.updateStudyModal(modal, studyCards, currentIndex, knownCards);
        document.body.appendChild(modal);
    }

    updateStudyModal(modal, cards, currentIndex, knownCards) {
        if (currentIndex >= cards.length) {
            this.endStudySession(modal, knownCards, cards.length);
            return;
        }

        const currentCard = cards[currentIndex];
        
        modal.innerHTML = `
            <div class="study-content glass" style="padding: 2rem; border-radius: 1rem; max-width: 500px; width: 90%; text-align: center;">
                <h3 style="margin-bottom: 1rem;">Study Mode</h3>
                
                <div class="progress-bar" style="margin: 1rem 0; background: var(--bg-tertiary); border-radius: 4px; height: 8px;">
                    <div class="progress-fill" style="height: 100%; background: var(--gradient-primary); border-radius: 4px; width: ${(currentIndex / cards.length) * 100}%; transition: width 0.3s ease;"></div>
                </div>
                
                <div style="margin-bottom: 1rem; color: var(--text-secondary);">
                    Card ${currentIndex + 1} of ${cards.length}
                </div>
                
                <div class="study-card" style="margin: 2rem 0;">
                    <div class="flashcard" onclick="this.classList.toggle('flipped')" style="width: 100%; height: 200px; perspective: 1000px; cursor: pointer;">
                        <div class="flashcard-inner" style="width: 100%; height: 100%; position: relative; transform-style: preserve-3d; transition: transform 0.6s ease;">
                            <div class="flashcard-front" style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: var(--gradient-primary); color: white; border-radius: 0.75rem; padding: 1.5rem; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-lg);">
                                <h4 style="margin: 0; text-align: center;">${currentCard.front}</h4>
                            </div>
                            <div class="flashcard-back" style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: var(--bg-primary); color: var(--text-primary); border-radius: 0.75rem; padding: 1.5rem; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-lg); border: 1px solid var(--border-light); transform: rotateY(180deg);">
                                <p style="margin: 0; text-align: center; line-height: 1.5;">${currentCard.back}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="study-actions" style="display: flex; gap: 1rem; justify-content: center;">
                    <button class="btn" style="background: var(--accent-error); color: white;" onclick="flashcardGenerator.markUnknown(${currentIndex}, ${knownCards}, ${cards.length})">Don't Know</button>
                    <button class="btn" style="background: var(--accent-success); color: white;" onclick="flashcardGenerator.markKnown(${currentIndex}, ${knownCards}, ${cards.length})">I Know This</button>
                </div>
                
                <div style="margin-top: 1rem;">
                    <button class="btn btn-outline" onclick="this.closest('.study-modal').remove()">Exit Study</button>
                </div>
            </div>
        `;
    }

    markKnown(currentIndex, knownCards, totalCards) {
        const modal = document.querySelector('.study-modal');
        if (!modal) return;

        const newKnownCards = knownCards + 1;
        const newIndex = currentIndex + 1;
        
        if (newIndex >= totalCards) {
            this.endStudySession(modal, newKnownCards, totalCards);
        } else {
            this.updateStudyModal(modal, this.flashcards, newIndex, newKnownCards);
        }
    }

    markUnknown(currentIndex, knownCards, totalCards) {
        const modal = document.querySelector('.study-modal');
        if (!modal) return;

        const newIndex = currentIndex + 1;
        
        if (newIndex >= totalCards) {
            this.endStudySession(modal, knownCards, totalCards);
        } else {
            this.updateStudyModal(modal, this.flashcards, newIndex, knownCards);
        }
    }

    endStudySession(modal, knownCards, totalCards) {
        const accuracy = Math.round((knownCards / totalCards) * 100);
        
        modal.innerHTML = `
            <div class="study-content glass" style="padding: 2rem; border-radius: 1rem; max-width: 500px; width: 90%; text-align: center;">
                <h3 style="margin-bottom: 1rem;">Study Session Complete! 🎉</h3>
                <div style="font-size: 3rem; margin: 1rem 0;">${this.getScoreEmoji(accuracy)}</div>
                <h2 style="margin: 1rem 0;">${knownCards}/${totalCards} (${accuracy}%)</h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">${this.getScoreMessage(accuracy)}</p>
                <button class="btn btn-primary" onclick="this.closest('.study-modal').remove()">Close</button>
            </div>
        `;
    }

    getScoreEmoji(accuracy) {
        if (accuracy >= 90) return '🏆';
        if (accuracy >= 75) return '🎯';
        if (accuracy >= 60) return '👍';
        return '📚';
    }

    getScoreMessage(accuracy) {
        if (accuracy >= 90) return 'Excellent! You have mastered this material.';
        if (accuracy >= 75) return 'Great job! You have a good understanding.';
        if (accuracy >= 60) return 'Good effort! Review the material and try again.';
        return 'Keep practicing! Review the difficult cards and try again.';
    }

    exportJSON() {
        if (this.flashcards.length === 0) {
            FlashJUtils.showToast('No flashcards to export!', 'warning');
            return;
        }

        const exportData = {
            flashcards: this.flashcards,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };

        FlashJUtils.downloadJSON(exportData, `flashj-flashcards-${Date.now()}.json`);
        FlashJUtils.showToast('Flashcards exported as JSON!', 'success');
    }

    exportPDF() {
        FlashJUtils.showToast('Preparing printable flashcards...', 'info');
        
        const printWindow = window.open('', '_blank');
        const printContent = this.generatePrintableContent();
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    }

    generatePrintableContent() {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>FlashJ Flashcards - Printable</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 2rem;
                        background: white;
                        color: black;
                    }
                    .flashcard-print { 
                        border: 2px solid #333; 
                        padding: 1.5rem; 
                        margin: 1rem 0; 
                        break-inside: avoid;
                        border-radius: 0.5rem;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        page-break-inside: avoid;
                    }
                    .front { 
                        font-weight: bold; 
                        margin-bottom: 1rem;
                        font-size: 1.1rem;
                        color: #1a365d;
                        border-bottom: 1px solid #ccc;
                        padding-bottom: 0.5rem;
                    }
                    .back { 
                        color: #2d3748;
                        line-height: 1.5;
                    }
                    .topic { 
                        background: #e2e8f0; 
                        padding: 0.25rem 0.5rem; 
                        border-radius: 0.25rem; 
                        font-size: 0.875rem;
                        display: inline-block;
                        margin-bottom: 0.5rem;
                    }
                    @media print {
                        .flashcard-print { 
                            page-break-inside: avoid; 
                            border: 1px solid #ccc;
                            margin: 0.5rem 0;
                        }
                        body { margin: 1rem; }
                    }
                </style>
            </head>
            <body>
                <h1>FlashJ Flashcards</h1>
                <p>Generated on ${new Date().toLocaleDateString()} - Total: ${this.flashcards.length} cards</p>
                <hr>
                ${this.flashcards.map(card => `
                    <div class="flashcard-print">
                        <div class="topic">${card.topic}</div>
                        <div class="front">${card.front}</div>
                        <div class="back">${card.back}</div>
                    </div>
                `).join('')}
            </body>
            </html>
        `;
    }

    updateStats() {
        const stats = {
            totalCards: this.flashcards.length,
            topics: [...new Set(this.flashcards.map(c => c.topic))].length,
            averageDifficulty: this.calculateAverageDifficulty(),
            studyReady: this.flashcards.filter(c => !c.lastReviewed || Date.now() - new Date(c.lastReviewed).getTime() > 24 * 60 * 60 * 1000).length
        };

        const statsElement = document.getElementById('flashcardsStats');
        if (statsElement) {
            statsElement.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div class="stat-card text-center">
                        <div class="stat-number">${stats.totalCards}</div>
                        <div class="stat-label">Total Cards</div>
                    </div>
                    <div class="stat-card text-center">
                        <div class="stat-number">${stats.topics}</div>
                        <div class="stat-label">Topics</div>
                    </div>
                    <div class="stat-card text-center">
                        <div class="stat-number">${stats.averageDifficulty}</div>
                        <div class="stat-label">Avg Difficulty</div>
                    </div>
                    <div class="stat-card text-center">
                        <div class="stat-number">${stats.studyReady}</div>
                        <div class="stat-label">Ready to Study</div>
                    </div>
                </div>
            `;
        }
    }

    calculateAverageDifficulty() {
        if (this.flashcards.length === 0) return 'N/A';
        
        const difficultyScores = {
            'easy': 1,
            'medium': 2,
            'hard': 3
        };

        const total = this.flashcards.reduce((sum, card) => {
            return sum + (difficultyScores[card.difficulty] || 2);
        }, 0);

        const average = total / this.flashcards.length;
        
        if (average < 1.5) return 'Easy';
        if (average < 2.5) return 'Medium';
        return 'Hard';
    }

    saveData() {
        FlashJUtils.saveToLocalStorage('flashj-flashcards', this.flashcards);
        FlashJUtils.saveToLocalStorage('flashj-leitner', this.leitnerBoxes);
    }
}

// Initialize when page loads
if (document.getElementById('flashcardsContainer')) {
    const flashcardGenerator = new FlashcardGenerator();
    window.flashcardGenerator = flashcardGenerator;
}