document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const fieldsContainer = document.getElementById('fieldsContainer');
    const addFieldBtn = document.getElementById('addField');
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
    const currentPasswordInput = document.getElementById('currentPasswordInput');
    const newPasswordInput = document.getElementById('newPasswordInput');
    const wipeProtectedBtn = document.getElementById('wipeProtected');


    let PASSWORD = ''; // Default fallback
    let notificationTimeout = null;  // For the notification to disappear 


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

    chrome.storage.local.get(['hasSeenOnboarding'], (result) => {
        if (!result.hasSeenOnboarding && !PASSWORD) {
            showNotification('🔒 Set a password in Settings to enable protected fields');

            chrome.storage.local.set({ hasSeenOnboarding: true });
        }
    });


    // Event Listeners
    addFieldBtn.addEventListener('click', addNewField);
    cancelDeleteBtn.addEventListener('click', hideConfirmationModal);
    confirmDeleteBtn.addEventListener('click', confirmDeleteField);
    searchInput.addEventListener('input', handleSearch);
    exportBtn.addEventListener('click', () => {
        if (!verifyPasswordOrFail('export your data')) return;
        handleExport();
    });
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', handleImport);

    // Functions

    openSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('show');
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
    });


    cancelSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('show');
    });

    savePasswordBtn.addEventListener('click', () => {
        const current = currentPasswordInput.value;
        const next = newPasswordInput.value;

        if (!next) {
            showNotification('New password cannot be empty');
            return;
        }

        // Case 1: No password set yet
        if (!PASSWORD) {
            PASSWORD = next;
            chrome.storage.local.set({ password: PASSWORD }, () => {
                showNotification('Password set successfully');
                settingsModal.classList.remove('show');
            });
            return;
        }

        // Case 2: Password exists → must verify
        if (current !== PASSWORD) {
            showNotification('Incorrect current password');
            return;
        }

        PASSWORD = next;
        chrome.storage.local.set({ password: PASSWORD }, () => {
            showNotification('Password changed successfully');
            settingsModal.classList.remove('show');
        });
    });

    wipeProtectedBtn.addEventListener('click', () => {
        const firstConfirm = confirm(
            'This will permanently delete ALL protected field values.\n\nThis action CANNOT be undone.\n\nDo you want to continue?'
        );

        if (!firstConfirm) return;

        const secondConfirm = confirm(
            'FINAL WARNING:\n\nProtected data will be erased forever.\n\nPress OK to confirm.'
        );

        if (!secondConfirm) return;

        wipeProtectedData();
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

        const pinnedFields = fields.filter(f => f.pinned);
        const normalFields = fields.filter(f => !f.pinned);

        [...pinnedFields, ...normalFields].forEach(field => {
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
                <button
                    class="fav-btn btn-star ${field.pinned ? 'active' : ''}"
                    title="${field.pinned ? 'Unpin field' : 'Pin field'}"
                    >
                    <i class="${field.pinned ? 'fa-solid fa-star' : 'fa-regular fa-star'}"></i>
                </button>

                ${!field.protected ? `
                    <button class="btn btn-copy" aria-label="Copy ${field.label}" title="Copy to clipboard"><i class="fa-regular fa-clipboard"></i></button>
                ` : ''}
                <button class="btn btn-delete" aria-label="Delete ${field.label}" title="Delete field"><i class="fa-regular fa-circle-xmark"></i></button>
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
            const starBtn = fieldDiv.querySelector('.btn-star');

            if (starBtn) {
                starBtn.addEventListener('click', () => {
                    const fieldIndex = fields.findIndex(f => f.id === field.id);
                    if (fieldIndex === -1) return;

                    fields[fieldIndex].pinned = !fields[fieldIndex].pinned;

                    chrome.storage.local.set({ fields }, () => {
                        renderFields();
                        showNotification(
                            fields[fieldIndex].pinned ? 'Field pinned ⭐' : 'Field unpinned'
                        );
                    });
                });
            }

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
            <button class="btn btn-save btn-save-field">
                <span class="btn-icon"><i class="fa-regular fa-floppy-disk"></i></span>
                <span class="btn-text">Save</span>
            </button>
        `;

            const saveFieldBtn = fieldDiv.querySelector('.btn-save-field');

            saveFieldBtn.addEventListener('click', () => {
                const labelInput = fieldDiv.querySelector('.field-label-input');
                const valueInput = fieldDiv.querySelector('.field-value-input');
                const protectedCheckbox = fieldDiv.querySelector('.field-protected-checkbox');

                const fieldIndex = fields.findIndex(f => f.id === field.id);
                if (fieldIndex === -1) return;

                fields[fieldIndex].label = labelInput.value;
                fields[fieldIndex].value = valueInput.value;

                if(fields[fieldIndex].label === ''){
                    showNotification('Please enter a Label before saving');
                }
                else if(fields[fieldIndex].value === ''){
                    showNotification('Please enter a Value before saving');
                }
                else{
                    if (protectedCheckbox?.checked && !PASSWORD) {
                        showNotification('Set a password to use protected fields');
                        fields[fieldIndex].protected = false;
                    } else {
                        fields[fieldIndex].protected = protectedCheckbox?.checked || false;
                    }
    
                    fields[fieldIndex].locked = true; // 🔒 ONLY THIS FIELD
    
                    chrome.storage.local.set({ fields }, () => {
                        renderFields();
                        showNotification('Field saved');
                    });
                }
            });
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
            protected: false,
            pinned: false
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
                    if (protectedCheckbox?.checked && !PASSWORD) {
                        showNotification('Set a password to use protected fields');
                        fields[fieldIndex].protected = false;
                    } else {
                        fields[fieldIndex].protected = protectedCheckbox?.checked || false;
                    }

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
        if (notificationTimeout) {
            clearTimeout(notificationTimeout);
            notificationTimeout = null;
        }

        notificationText.textContent = message;
        notification.classList.add('show');

        notificationTimeout = setTimeout(() => {
            notification.classList.remove('show');
            notificationTimeout = null;
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

    function verifyPasswordOrFail(actionName = 'perform this action') {
        if (!PASSWORD) return true; // No password set → allow

        const entered = prompt(`Enter password to ${actionName}:`);
        if (entered === PASSWORD) return true;

        showNotification('Incorrect password');
        return false;
    }

    function wipeProtectedData() {
        let modified = false;

        fields = fields.map(field => {
            if (field.protected) {
                modified = true;
                return {
                    ...field,
                    value: '',
                    locked: true,
                    protected: false
                };
            }
            return field;
        });

        PASSWORD = '';
        chrome.storage.local.set(
            {
                fields: fields,
                password: ''
            },
            () => {
                renderFields();
                settingsModal.classList.remove('show');
                showNotification('Protected fields wiped and password reset');
            }
        );
    }

});