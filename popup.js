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
    const exportBtn = document.getElementById('export');
    const importBtn = document.getElementById('import');
    const importFileInput = document.getElementById('importFile');
    const openSettingsBtn = document.getElementById('openSettings');
    const settingsModal = document.getElementById('settingsModal');
    const cancelSettingsBtn = document.getElementById('cancelSettings');
    const savePasswordBtn = document.getElementById('savePassword');
    const passwordInput = document.getElementById('passwordInput');

    let PASSWORD = ''; // Default fallback


    // State variables
    let fields = [];
    let fieldToDelete = null;

    // Load saved fields from storage
    loadFields();

    chrome.storage.local.get(['password'], (result) => {
        if (result.password) {
            PASSWORD = result.password;
        }
    });

    // Event Listeners
    addFieldBtn.addEventListener('click', addNewField);
    saveBtn.addEventListener('click', saveFields);
    cancelDeleteBtn.addEventListener('click', hideConfirmationModal);
    confirmDeleteBtn.addEventListener('click', confirmDeleteField);
    searchInput.addEventListener('input', handleSearch);
    exportBtn.addEventListener('click', handleExport);
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', handleImport);

    // Functions

    openSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('show');
        passwordInput.value = PASSWORD || '';
    });

    cancelSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('show');
    });

    savePasswordBtn.addEventListener('click', () => {
        PASSWORD = passwordInput.value;
        chrome.storage.local.set({ password: PASSWORD }, () => {
            showNotification('Password saved!');
            settingsModal.classList.remove('show');
        });
    });


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
                ${!field.protected ? `
                    <button class="btn btn-copy" aria-label="Copy ${field.label}" title="Copy to clipboard">📋</button>
                ` : ''}
                <button class="btn btn-delete" aria-label="Delete ${field.label}" title="Delete field">❌</button>
            </div>
          </div>
         <div class="field-content">
            <div class="field-value">
                ${field.protected ? '••••••••' : field.value}
                ${field.protected ? '<button class="btn btn-eye" title="Reveal value">👁️</button>' : ''}
            </div>
        </div>
        `;

            // Add event listeners for copy and delete buttons
            const copyBtn = fieldDiv.querySelector('.btn-copy');
            const deleteBtn = fieldDiv.querySelector('.btn-delete');

            if (copyBtn) {
                copyBtn.addEventListener('click', function () {
                    copyToClipboard(field.value);
                    showNotification('Copied to clipboard!');
                    copyBtn.classList.add('copied');
                    setTimeout(() => copyBtn.classList.remove('copied'), 500);
                });
            }

            deleteBtn.addEventListener('click', function () {
                showDeleteConfirmation(field.id);
            });

            if (field.protected) {
                const eyeBtn = fieldDiv.querySelector('.btn-eye');
                eyeBtn.addEventListener('click', function () {
                    const valueDiv = fieldDiv.querySelector('.field-value');
                    const enteredPassword = prompt('Enter password to view this field:');
                    if (enteredPassword == PASSWORD) {
                        valueDiv.classList.remove('protected');
                        valueDiv.classList.add('revealed');
                        valueDiv.textContent = field.value;

                        const copyBtn = document.createElement('button');
                        copyBtn.className = 'btn btn-copy';
                        copyBtn.title = 'Copy to clipboard';
                        copyBtn.innerText = '📋';

                        copyBtn.addEventListener('click', () => {
                            copyToClipboard(field.value);
                            showNotification('Copied to clipboard!');
                            copyBtn.classList.add('copied');
                            setTimeout(() => copyBtn.classList.remove('copied'), 500);
                        });

                        const buttonContainer = fieldDiv.querySelector('.field-buttons');
                        buttonContainer.insertBefore(copyBtn, buttonContainer.firstChild);
                    } else {
                        showNotification('Incorrect password!');
                    }
                });
            }
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
          <div class="input-group checkbox-group">
            <input type="checkbox" id="protec" class="field-protected-checkbox" ${field.protected ? 'checked' : ''}>
            <label class="input-label" for="protec">
                Protected
            </label>
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
            isDefault: false,
            protected: false
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
            const protectedCheckbox = fieldElement.querySelector('.field-protected-checkbox');

            if (labelInput && valueInput) {
                const fieldIndex = fields.findIndex(f => f.id === id);

                if (fieldIndex !== -1) {
                    fields[fieldIndex].label = labelInput.value;
                    fields[fieldIndex].value = valueInput.value;
                    fields[fieldIndex].protected = protectedCheckbox?.checked || false;
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

    function handleExport() {
        const dataStr = JSON.stringify(fields, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'clipboarded_data.json';
        a.click();

        URL.revokeObjectURL(url);
    }

    function handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const importedFields = JSON.parse(e.target.result);
                if (Array.isArray(importedFields)) {
                    fields = importedFields.map(field => ({
                        ...field,
                        id: field.id || generateId(), // ensure id exists
                    }));
                    chrome.storage.local.set({ fields: fields }, () => {
                        renderFields();
                        showNotification('Fields imported successfully!');
                    });
                } else {
                    throw new Error("Invalid format");
                }
            } catch (err) {
                console.error("Import error:", err);
                showNotification('Invalid JSON file');
            }
        };
        reader.readAsText(file);
    }

});