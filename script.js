document.addEventListener('DOMContentLoaded', () => {
    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');
    const categoryInput = document.getElementById('category-input');
    const todoList = document.getElementById('todo-list');
    const taskCount = document.getElementById('task-count');
    const filterButtons = document.getElementById('filter-buttons');
    const clearCompletedBtn = document.getElementById('clear-completed-btn');
    const categoryFilter = document.getElementById('category-filter');

    let todos = [];
    let currentFilter = 'all';
    let currentCategoryFilter = 'all';

    // Firebase functions
    const { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } = window.firestore;
    const db = window.db;
    const todosCollection = collection(db, 'todos');

    // Load todos from Firestore
    const loadTodos = () => {
        const q = query(todosCollection, orderBy('createdAt', 'desc'));
        onSnapshot(q, (querySnapshot) => {
            todos = [];
            querySnapshot.forEach((doc) => {
                todos.push({
                    firestoreId: doc.id,
                    ...doc.data()
                });
            });
            updateCategoryFilter();
            renderTodos();
        });
    };

    // Add todo to Firestore
    const addTodoToFirestore = async (todoData) => {
        try {
            await addDoc(todosCollection, {
                ...todoData,
                createdAt: new Date()
            });
        } catch (error) {
            console.error('Error adding todo:', error);
        }
    };

    // Update todo in Firestore
    const updateTodoInFirestore = async (firestoreId, updates) => {
        try {
            const todoRef = doc(db, 'todos', firestoreId);
            await updateDoc(todoRef, updates);
        } catch (error) {
            console.error('Error updating todo:', error);
        }
    };

    // Delete todo from Firestore
    const deleteTodoFromFirestore = async (firestoreId) => {
        try {
            await deleteDoc(doc(db, 'todos', firestoreId));
        } catch (error) {
            console.error('Error deleting todo:', error);
        }
    };

    const updateCategoryFilter = () => {
        const categories = [...new Set(todos.map(todo => todo.category).filter(Boolean))];
        const currentSelection = categoryFilter.value;
        
        categoryFilter.innerHTML = '<option value="all">All Categories</option>';
        
        categories.sort().forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });

        if (categories.includes(currentSelection)) {
             categoryFilter.value = currentSelection;
        } else {
            categoryFilter.value = 'all';
            currentCategoryFilter = 'all';
        }
    };

    const renderTodos = () => {
        todoList.innerHTML = '';
        const filteredTodos = todos.filter(todo => {
            const statusMatch = 
                (currentFilter === 'active' && !todo.completed) ||
                (currentFilter === 'completed' && todo.completed) ||
                currentFilter === 'all';
            
            const categoryMatch = currentCategoryFilter === 'all' || todo.category === currentCategoryFilter;

            return statusMatch && categoryMatch;
        });

        if (filteredTodos.length === 0) {
            const emptyStateMessage = 
                currentCategoryFilter !== 'all' ? `No tasks in the "${currentCategoryFilter}" category.` :
                currentFilter === 'completed' ? "No completed tasks yet." :
                currentFilter === 'active' ? "All tasks completed! ✨" :
                "Add a task to get started!";
            
            todoList.innerHTML = `<li class="text-center text-slate-400 p-4">${emptyStateMessage}</li>`;
        } else {
            filteredTodos.forEach(todo => {
                const li = document.createElement('li');
                li.className = `todo-item flex items-center bg-slate-50 p-3 rounded-lg shadow-sm ${todo.completed ? 'completed' : ''}`;
                li.dataset.firestoreId = todo.firestoreId;
                
                li.innerHTML = `
                    <input type="checkbox" ${todo.completed ? 'checked' : ''} class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer">
                    <div class="flex-grow mx-3">
                        <span class="text-slate-800">${todo.text}</span>
                        ${todo.category ? `<span class="ml-2 text-xs font-semibold px-2 py-0.5 bg-sky-100 text-sky-700 rounded-full align-middle">${todo.category}</span>` : ''}
                    </div>
                    <button class="delete-btn text-slate-400 hover:text-red-500 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                `;
                todoList.appendChild(li);
            });
        }
        updateTaskCount();
    };
    
    const updateTaskCount = () => {
        const activeTodos = todos.filter(todo => !todo.completed).length;
        taskCount.textContent = `${activeTodos} ${activeTodos === 1 ? 'task' : 'tasks'} left`;

        const completedExists = todos.some(todo => todo.completed);
        clearCompletedBtn.classList.toggle('hidden', !completedExists);
    };

    todoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newTodoText = todoInput.value.trim();
        const newTodoCategory = categoryInput.value.trim();
        if (newTodoText) {
            const newTodo = {
                text: newTodoText,
                completed: false,
                category: newTodoCategory || 'General',
            };
            await addTodoToFirestore(newTodo);
            todoInput.value = '';
            categoryInput.value = '';
        }
    });

    todoList.addEventListener('click', async (e) => {
        const target = e.target;
        const li = target.closest('.todo-item');
        if (!li) return;
        
        const firestoreId = li.dataset.firestoreId;

        if (target.type === 'checkbox') {
            const todo = todos.find(t => t.firestoreId === firestoreId);
            if (todo) {
                await updateTodoInFirestore(firestoreId, { completed: !todo.completed });
                if (currentFilter !== 'all') {
                    li.classList.add('removing');
                    // The real-time listener will handle the re-render
                }
            }
        }

        if (target.closest('.delete-btn')) {
            await deleteTodoFromFirestore(firestoreId);
            li.classList.add('removing');
            // The real-time listener will handle the re-render
        }
    });

    filterButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const filterValue = e.target.dataset.filter;
            if (filterValue) {
                currentFilter = filterValue;
                document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                renderTodos();
            }
        }
    });

    categoryFilter.addEventListener('change', (e) => {
        currentCategoryFilter = e.target.value;
        renderTodos();
    });

    clearCompletedBtn.addEventListener('click', async () => {
        const completedTodos = todos.filter(todo => todo.completed);
        const deletePromises = completedTodos.map(todo => deleteTodoFromFirestore(todo.firestoreId));
        await Promise.all(deletePromises);
    });

    // Initialize the app
    loadTodos();
});
