document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const fieldsContainer = document.getElementById('fieldsContainer');
    const addFieldBtn = document.getElementById('addField');
    const saveBtn = document.getElementById('save');
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    const confirmationModal = document.getElementById('confirmationModal');
    const cancelDeleteBtn = document.getElementById('cancelDelete');
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    const searchInput = document.getElementById('searchInput');

    // State variables
    let fields = [];
    let fieldToDelete = null;

    // Load saved fields from storage
    loadFields();

    // Event Listeners
    addFieldBtn.addEventListener('click', addNewField);
    saveBtn.addEventListener('click', saveFields);
    cancelDeleteBtn.addEventListener('click', hideConfirmationModal);
    confirmDeleteBtn.addEventListener('click', confirmDeleteField);
    searchInput.addEventListener('input', handleSearch);

    // Functions
    function loadFields() {
        chrome.storage.local.get(['fields'], function (result) {
            if (result.fields && result.fields.length > 0) {
                fields = result.fields;
                renderFields();
            } else {
                // Add default fields
                fields = [
                    { id: generateId(), label: 'Name', value: '', locked: false, isDefault: true },
                    { id: generateId(), label: 'Phone Number', value: '', locked: false, isDefault: true }
                ];
                renderFields();
            }
        });
    }

    function renderFields() {
        fieldsContainer.innerHTML = '';

        fields.forEach(field => {
            const fieldElement = createFieldElement(field);
            fieldsContainer.appendChild(fieldElement);
        });
    }

    function createFieldElement(field) {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = `field ${field.locked ? 'locked' : 'editable'}`;
        fieldDiv.dataset.id = field.id;

        if (field.locked) {
            // Locked field view
            fieldDiv.innerHTML = `
          <div class="field-header">
            <span class="field-title">${field.label}</span>
            <div class="field-buttons">
              <button class="btn btn-copy" aria-label="Copy ${field.label}" title="Copy to clipboard">📋</button>
              <button class="btn btn-delete" aria-label="Delete ${field.label}" title="Delete field">❌</button>
            </div>
          </div>
          <div class="field-content">
            <div class="field-value">${field.value}</div>
          </div>
        `;

            // Add event listeners for copy and delete buttons
            const copyBtn = fieldDiv.querySelector('.btn-copy');
            const deleteBtn = fieldDiv.querySelector('.btn-delete');

            copyBtn.addEventListener('click', function () {
                copyToClipboard(field.value);
                showNotification('Copied to clipboard!');
                copyBtn.classList.add('copied');
                setTimeout(() => copyBtn.classList.remove('copied'), 500);
            });

            deleteBtn.addEventListener('click', function () {
                showDeleteConfirmation(field.id);
            });
        } else {
            // Editable field view
            fieldDiv.innerHTML = `
          <div class="input-group">
            <label class="input-label">Label</label>
            <input type="text" class="field-label-input" value="${field.label}" placeholder="Label" ${field.isDefault ? 'readonly' : ''}>
          </div>
          <div class="input-group">
            <label class="input-label">Value</label>
            <input type="text" class="field-value-input" value="${field.value}" placeholder="Value">
          </div>
        `;
        }

        return fieldDiv;
    }

    function handleSearch(event) {
        const searchTerm = event.target.value.toLowerCase();
        const fieldElements = fieldsContainer.querySelectorAll('.field');

        fieldElements.forEach(fieldElement => {
            const label = fieldElement.querySelector('.field-title')?.textContent.toLowerCase() ||
                fieldElement.querySelector('.field-label-input')?.value.toLowerCase() || '';
            const value = fieldElement.querySelector('.field-value')?.textContent.toLowerCase() ||
                fieldElement.querySelector('.field-value-input')?.value.toLowerCase() || '';

            if (label.includes(searchTerm) || value.includes(searchTerm)) {
                fieldElement.classList.remove('hidden');
            } else {
                fieldElement.classList.add('hidden');
            }
        });
    }

    function addNewField() {
        const newField = {
            id: generateId(),
            label: '',
            value: '',
            locked: false,
            isDefault: false
        };

        fields.push(newField);

        const fieldElement = createFieldElement(newField);
        fieldElement.classList.add('new-field');
        fieldsContainer.appendChild(fieldElement);

        // Scroll to the new field
        fieldElement.scrollIntoView({ behavior: 'smooth' });
    }

    function saveFields() {
        // Get all editable fields and update their values
        const fieldElements = fieldsContainer.querySelectorAll('.field.editable');

        fieldElements.forEach(fieldElement => {
            const id = fieldElement.dataset.id;
            const labelInput = fieldElement.querySelector('.field-label-input');
            const valueInput = fieldElement.querySelector('.field-value-input');

            if (labelInput && valueInput) {
                const fieldIndex = fields.findIndex(f => f.id === id);

                if (fieldIndex !== -1) {
                    fields[fieldIndex].label = labelInput.value;
                    fields[fieldIndex].value = valueInput.value;
                    fields[fieldIndex].locked = true; // Lock the field after saving
                }
            }
        });

        // Save to storage
        chrome.storage.local.set({ fields: fields }, function () {
            renderFields();
            showNotification('Fields saved successfully!');
        });
    }

    function showDeleteConfirmation(fieldId) {
        fieldToDelete = fieldId;
        confirmationModal.classList.add('show');
    }

    function hideConfirmationModal() {
        confirmationModal.classList.remove('show');
        fieldToDelete = null;
    }

    function confirmDeleteField() {
        if (fieldToDelete) {
            deleteField(fieldToDelete);
            hideConfirmationModal();
        }
    }

    function deleteField(fieldId) {
        fields = fields.filter(field => field.id !== fieldId);

        // Save to storage
        chrome.storage.local.set({ fields: fields }, function () {
            renderFields();
            showNotification('Field deleted!');
        });
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Could not copy text: ', err);
        });
    }

    function showNotification(message) {
        notificationText.textContent = message;
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
        }, 2000);
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
});