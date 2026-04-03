// ==================== CẤU HÌNH GROQ API ====================
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_API_KEY = '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';

let apiKey = DEFAULT_API_KEY;
let currentQuestions = [];

// ==================== QUẢN LÝ DỮ LIỆU ====================
let userData = {
    highScore: 0,
    totalQuizzes: 0,
    history: [],
    savedGrade: '5',
    savedTopic: 'all'
};

function loadUserData() {
    const saved = localStorage.getItem('mathLearningData');
    if (saved) {
        userData = JSON.parse(saved);
        updateStatsDisplay();
        renderHistory();
    }
    
    if (userData.savedGrade) {
        const gradeSelect = document.getElementById('grade');
        if (gradeSelect) gradeSelect.value = userData.savedGrade;
    }
    if (userData.savedTopic) {
        const topicSelect = document.getElementById('topic');
        if (topicSelect) topicSelect.value = userData.savedTopic;
    }
}

function saveSelectedOptions() {
    const gradeSelect = document.getElementById('grade');
    const topicSelect = document.getElementById('topic');
    if (gradeSelect) userData.savedGrade = gradeSelect.value;
    if (topicSelect) userData.savedTopic = topicSelect.value;
    saveUserData();
}

function updateStatsDisplay() {
    const highScoreEl = document.getElementById('highScore');
    const totalEl = document.getElementById('totalQuizzes');
    if (highScoreEl) highScoreEl.textContent = userData.highScore;
    if (totalEl) totalEl.textContent = userData.totalQuizzes;
}

function saveUserData() {
    localStorage.setItem('mathLearningData', JSON.stringify(userData));
}

function addToHistory(score, total, grade, topic) {
    userData.history.unshift({
        id: Date.now(),
        date: new Date().toISOString(),
        score: score,
        total: total,
        grade: grade,
        topic: topic
    });
    
    if (userData.history.length > 50) userData.history.pop();
    if (score > userData.highScore) userData.highScore = score;
    userData.totalQuizzes++;
    
    saveUserData();
    updateStatsDisplay();
    renderHistory();
}

function renderHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    
    if (userData.history.length === 0) {
        historyList.innerHTML = '<div class="empty-history">Chưa có bài làm nào</div>';
        return;
    }
    
    historyList.innerHTML = userData.history.map(item => {
        const date = new Date(item.date);
        const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
        const percent = (item.score / item.total) * 100;
        let scoreClass = 'bad';
        if (percent >= 80) scoreClass = 'good';
        else if (percent >= 50) scoreClass = 'medium';
        
        return `
            <div class="history-item">
                <div class="history-date">${formattedDate}</div>
                <div class="history-grade">Lớp ${item.grade}</div>
                <div class="history-score ${scoreClass}">${item.score}/${item.total}</div>
            </div>
        `;
    }).join('');
}

function toggleHistory() {
    const historyList = document.getElementById('historyList');
    const icon = document.getElementById('historyToggleIcon');
    if (historyList.classList.contains('show')) {
        historyList.classList.remove('show');
        icon.style.transform = 'rotate(0deg)';
    } else {
        historyList.classList.add('show');
        icon.style.transform = 'rotate(180deg)';
    }
}

// ==================== GỌI GROQ API ====================
async function callGroqAPI(prompt) {
    const modelsToTry = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'];
    let lastError = null;

    for (const model of modelsToTry) {
        try {
            const response = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 4096
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `Lỗi HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (err) {
            console.warn(`Model ${model} thất bại:`, err.message);
            lastError = err;
        }
    }
    throw lastError || new Error('Không có model nào hoạt động');
}

// ==================== NGÂN HÀNG CÂU HỎI THEO LỚP (CHUẨN SGK) ====================
const QUESTION_BANKS = {
    5: [
        { text: "Tính: 12,5 × 4,8 = ?", answer: 60, explanation: "12,5 × 4,8 = 60" },
        { text: "Một cửa hàng bán 2/3 số gạo, còn lại 150kg. Hỏi lúc đầu có bao nhiêu kg?", answer: 450, explanation: "150kg = 1/3 số gạo → Tổng = 450kg" },
        { text: "Tính diện tích hình chữ nhật có chiều dài 24,5m, chiều rộng 8,4m", answer: 205.8, explanation: "24,5 × 8,4 = 205,8 m²" },
        { text: "Tìm x: 3,5 × x = 24,5", answer: 7, explanation: "x = 24,5 : 3,5 = 7" },
        { text: "Một hình tam giác có đáy 12cm, chiều cao 8cm. Tính diện tích", answer: 48, explanation: "12 × 8 : 2 = 48 cm²" },
        { text: "Tính: 3/4 + 2/5 = ? (viết dưới dạng số thập phân)", answer: 1.15, explanation: "3/4 = 0,75; 2/5 = 0,4; 0,75 + 0,4 = 1,15" },
        { text: "Một người đi xe máy trong 2,5 giờ được 87,5km. Tính vận tốc", answer: 35, explanation: "87,5 : 2,5 = 35 km/h" }
    ],
    6: [
        { text: "Tìm x: 3x + 7 = 22", answer: 5, explanation: "3x = 15 → x = 5" },
        { text: "Tính diện tích hình thang có đáy lớn 15cm, đáy nhỏ 9cm, chiều cao 8cm", answer: 96, explanation: "(15+9)×8:2 = 96 cm²" }
    ],
    7: [
        { text: "Giải phương trình: 2(x-3) = 4x + 6", answer: -6, explanation: "2x-6=4x+6 → -12=2x → x=-6" },
        { text: "Tính: (-3)² × 2 = ?", answer: 18, explanation: "9 × 2 = 18" }
    ],
    8: [
        { text: "Tính (3√2)² = ?", answer: 18, explanation: "9 × 2 = 18" }
    ],
    9: [
        { text: "Giải hệ: x + y = 7 và x - y = 3", answer: "x=5,y=2", explanation: "Cộng hai pt: 2x=10→x=5, y=2" }
    ],
    10: [
        { text: "Tìm tập xác định của hàm số y = √(x² - 4)", answer: "x ≤ -2 hoặc x ≥ 2", explanation: "x²-4 ≥ 0 → x ≤ -2 hoặc x ≥ 2" }
    ]
};

// ==================== TẠO CÂU HỎI (KẾT HỢP AI + NGÂN HÀNG) ====================
async function generateQuestionsWithAI(grade, topic, count = 10) {
    const gradeNum = parseInt(grade);
    
    // Lấy câu hỏi từ ngân hàng trước
    const bankQuestions = QUESTION_BANKS[gradeNum] || QUESTION_BANKS[5];
    const selectedQuestions = [];
    
    // Lấy câu hỏi từ ngân hàng (đảm bảo đúng chương trình)
    for (let i = 0; i < Math.min(count, bankQuestions.length); i++) {
        selectedQuestions.push({ ...bankQuestions[i % bankQuestions.length] });
    }
    
    // Nếu thiếu, bổ sung bằng AI (chỉ bổ sung dạng tính toán đơn giản)
    if (selectedQuestions.length < count) {
        const remaining = count - selectedQuestions.length;
        const prompt = `Tạo ${remaining} câu hỏi toán cho học sinh lớp ${grade}. Mỗi câu hỏi chỉ là phép tính ĐƠN GIẢN, có đáp số là SỐ CỤ THỂ.
        
Định dạng JSON:
{
    "text": "câu hỏi (chỉ phép tính cơ bản)",
    "answer": đáp_số,
    "explanation": "giải thích ngắn"
}

Ví dụ: {"text": "Tính: 25 × 4 = ?", "answer": 100, "explanation": "25 × 4 = 100"}

Trả về JSON array, không text khác.`;

        try {
            const responseText = await callGroqAPI(prompt);
            const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (jsonMatch) {
                const aiQuestions = JSON.parse(jsonMatch[0]);
                for (let i = 0; i < aiQuestions.length && selectedQuestions.length < count; i++) {
                    if (aiQuestions[i].text && typeof aiQuestions[i].answer === 'number') {
                        selectedQuestions.push(aiQuestions[i]);
                    }
                }
            }
        } catch (error) {
            console.warn('AI bổ sung thất bại:', error);
        }
    }
    
    // Đảm bảo đủ số lượng
    while (selectedQuestions.length < count) {
        selectedQuestions.push({
            text: `Tính: 25 × ${selectedQuestions.length + 4} = ?`,
            answer: 25 * (selectedQuestions.length + 4),
            explanation: `25 × ${selectedQuestions.length + 4} = ${25 * (selectedQuestions.length + 4)}`
        });
    }
    
    return selectedQuestions.slice(0, count);
}

// ==================== LẤY CÂU HỎI ====================
let questionsCache = {};

async function getQuestions(grade, topic, count = 10, forceRefresh = false) {
    const today = new Date().toDateString();
    const cacheKey = `${grade}_${topic}_${today}`;
    
    if (!forceRefresh && questionsCache[cacheKey]) {
        return questionsCache[cacheKey];
    }

    showLoading(true);
    try {
        const questions = await generateQuestionsWithAI(grade, topic, count);
        questionsCache[cacheKey] = questions;
        showLoading(false);
        return questions;
    } catch (error) {
        console.error('Error:', error);
        showLoading(false);
        throw error;
    }
}

// ==================== HIỂN THỊ CÂU HỎI (DẠNG NHẬP ĐÁP ÁN) ====================
function displayQuestions(questions) {
    currentQuestions = questions;
    const container = document.getElementById('quizContainer');
    container.innerHTML = '';
    
    const grade = document.getElementById('grade').value;
    const topicName = document.getElementById('topic').value === 'all' ? 'Toán' : document.getElementById('topic').value;
    
    const infoBar = document.createElement('div');
    infoBar.style.cssText = 'background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; padding: 12px 20px; border-radius: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;';
    infoBar.innerHTML = `
        <span><i class="fas fa-graduation-cap"></i> Lớp ${grade} - ${topicName}</span>
        <span><i class="fas fa-keyboard"></i> Nhập đáp án vào ô trống</span>
    `;
    container.appendChild(infoBar);

    questions.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.style.cssText = 'background: white; border-radius: 20px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;';
        card.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px;">
                <div style="background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">${idx + 1}</div>
                <div style="flex: 1; font-size: 17px; font-weight: 500; line-height: 1.4;">${q.text}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; margin-left: 52px;">
                <span style="font-weight: 600; color: #475569;">Đáp án:</span>
                <input type="number" id="answer_${idx}" step="any" style="flex: 1; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 16px; transition: all 0.2s;" placeholder="Nhập kết quả...">
                <span style="color: #94a3b8; font-size: 14px;">đơn vị</span>
            </div>
        `;
        container.appendChild(card);
    });

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn-submit';
    submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Nộp bài và xem kết quả';
    submitBtn.style.cssText = 'background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; border: none; width: 100%; padding: 16px; border-radius: 60px; font-weight: 700; font-size: 16px; cursor: pointer; margin-top: 20px; display: flex; align-items: center; justify-content: center; gap: 10px;';
    submitBtn.onclick = submitQuiz;
    container.appendChild(submitBtn);
    
    document.getElementById('resultContainer').style.display = 'none';
}

function showLoading(show) {
    const container = document.getElementById('quizContainer');
    if (show) {
        container.innerHTML = `
            <div class="loading-container" style="text-align: center; padding: 60px;">
                <div class="spinner" style="width: 50px; height: 50px; border: 4px solid #e2e8f0; border-top-color: #06b6d4; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <h3 style="margin-top: 16px;">🤖 AI đang tạo câu hỏi...</h3>
                <p style="color: #64748b; margin-top: 8px;">Vui lòng chờ trong giây lát</p>
                <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
            </div>
        `;
    }
}

function showErrorMessage(error) {
    const container = document.getElementById('quizContainer');
    container.innerHTML = `
        <div style="background: #fef2f2; border-radius: 24px; padding: 60px 40px; text-align: center;">
            <i class="fas fa-circle-exclamation" style="font-size: 56px; color: #ef4444; margin-bottom: 20px;"></i>
            <h3 style="margin-bottom: 16px;">⚠️ Không thể tải câu hỏi</h3>
            <p style="color: #64748b; margin-bottom: 24px;">${error.message}</p>
            <button id="retryBtn" style="background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; border: none; padding: 12px 28px; border-radius: 40px; font-weight: 600; cursor: pointer;">🔄 Thử lại</button>
        </div>
    `;
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) retryBtn.onclick = () => loadNewQuestions(true);
}

// ==================== CHẤM ĐIỂM (DẠNG NHẬP ĐÁP ÁN) ====================
function submitQuiz() {
    let score = 0;
    const answers = [];
    
    currentQuestions.forEach((q, idx) => {
        const inputEl = document.getElementById(`answer_${idx}`);
        const userAnswer = inputEl ? parseFloat(inputEl.value) : NaN;
        const isCorrect = !isNaN(userAnswer) && Math.abs(userAnswer - q.answer) < 0.01;
        if (isCorrect) score++;
        
        answers.push({
            question: q.text,
            userAnswer: isNaN(userAnswer) ? 'Chưa nhập' : userAnswer,
            correctAnswer: q.answer,
            isCorrect: isCorrect,
            explanation: q.explanation
        });
    });

    const grade = document.getElementById('grade').value;
    const topic = document.getElementById('topic').value;
    addToHistory(score, currentQuestions.length, grade, topic);

    document.getElementById('scoreNumber').textContent = score;
    const percentage = (score / 10) * 100;
    document.getElementById('progressFill').style.width = `${percentage}%`;

    let expanded = false;
    const detailsDiv = document.getElementById('detailedAnswers');
    
    document.getElementById('reviewBtn').onclick = () => {
        if (expanded) {
            detailsDiv.innerHTML = '';
            expanded = false;
        } else {
            detailsDiv.innerHTML = answers.map((ans, i) => `
                <div class="detailed-answer ${ans.isCorrect ? 'correct' : 'wrong'}" style="background: ${ans.isCorrect ? '#f0fdf4' : '#fef2f2'}; border-left: 4px solid ${ans.isCorrect ? '#10b981' : '#ef4444'}; padding: 16px; margin: 12px 0; border-radius: 12px;">
                    <strong>Câu ${i+1}: ${ans.question}</strong><br>
                    📝 Bạn: ${ans.userAnswer}<br>
                    ✅ Đáp án đúng: ${ans.correctAnswer}<br>
                    💡 ${ans.explanation}
                </div>
            `).join('');
            expanded = true;
        }
    };
    
    document.getElementById('newQuizBtn').onclick = () => {
        document.getElementById('resultContainer').style.display = 'none';
        loadNewQuestions();
    };
    
    document.getElementById('resultContainer').style.display = 'block';
    document.getElementById('resultContainer').scrollIntoView({ behavior: 'smooth' });
}

let isLoading = false;
async function loadNewQuestions(forceRefresh = false) {
    if (isLoading) return;
    isLoading = true;
    saveSelectedOptions();
    
    try {
        const grade = document.getElementById('grade').value;
        const topic = document.getElementById('topic').value;
        const questions = await getQuestions(grade, topic, 10, forceRefresh);
        displayQuestions(questions);
    } catch (error) {
        console.error('Error:', error);
        showErrorMessage(error);
    } finally {
        isLoading = false;
    }
}

// ==================== KHỞI TẠO ====================
document.addEventListener('DOMContentLoaded', () => {
    loadUserData();
    
    const gradeSelect = document.getElementById('grade');
    const topicSelect = document.getElementById('topic');
    const newBtn = document.getElementById('newQuestionsBtn');
    const startBtn = document.getElementById('startBtn');

    if (gradeSelect) gradeSelect.onchange = () => { saveSelectedOptions(); loadNewQuestions(); };
    if (topicSelect) topicSelect.onchange = () => { saveSelectedOptions(); loadNewQuestions(); };
    if (newBtn) newBtn.onclick = () => loadNewQuestions(true);
    if (startBtn) startBtn.onclick = () => loadNewQuestions();

    window.toggleHistory = toggleHistory;
    loadNewQuestions();
});