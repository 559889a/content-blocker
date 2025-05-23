/**
 * 内容屏蔽器 - SillyTavern扩展
 * 允许用户屏蔽被特定标签包裹的内容，使其对AI不可见但对用户可见
 */

// 扩展名称
const extensionName = 'content-blocker';

// 默认设置
const defaultSettings = {
    enabled: true,
    startTag: '<content>',
    endTag: '</content>',
    whitelistedPrompts: [],
    lastPromptList: []
};

/**
 * 初始化扩展设置
 */
function initSettings() {
    if (extension_settings[extensionName] === undefined) {
        extension_settings[extensionName] = {};
    }
    
    const settings = extension_settings[extensionName];
    for (const key in defaultSettings) {
        if (settings[key] === undefined) {
            settings[key] = defaultSettings[key];
        }
    }
    
    saveSettingsDebounced();
}

/**
 * 在提示组合前处理
 */
function onBeforeCombinePrompts(args) {
    if (!extension_settings[extensionName].enabled) {
        return;
    }
    
    const settings = extension_settings[extensionName];
    
    // 保存当前提示列表以便UI使用
    if (args && args.promptBits) {
        extension_settings[extensionName].lastPromptList = [...args.promptBits];
        saveSettingsDebounced();
    }
    
    // 使用正则表达式屏蔽被标签包裹的内容
    if (args && args.promptBits && Array.isArray(args.promptBits)) {
        for (let i = 0; i < args.promptBits.length; i++) {
            // 跳过白名单中的提示
            if (settings.whitelistedPrompts.includes(i)) {
                continue;
            }
            
            // 创建正则表达式，使用转义的标签来匹配
            const escapedStartTag = escapeRegExp(settings.startTag);
            const escapedEndTag = escapeRegExp(settings.endTag);
            const regex = new RegExp(`${escapedStartTag}(.*?)${escapedEndTag}`, 'gs');
            
            // 替换匹配的内容为空
            args.promptBits[i] = args.promptBits[i].replace(regex, '');
        }
    }
}

/**
 * 更新提示列表
 */
function updatePromptList() {
    console.log('聊天上下文已更新');
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 添加扩展UI
 */
function addExtensionUI() {
    const settingsHtml = `
        <div id="content_blocker_settings" class="content-blocker-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>内容屏蔽器</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div>
                        <label class="checkbox_label">
                            <input id="content_blocker_enabled" type="checkbox" ${extension_settings[extensionName].enabled ? 'checked' : ''}>
                            <span>启用内容屏蔽</span>
                        </label>
                    </div>
                    
                    <div class="content-blocker-tags">
                        <label>开始标签:</label>
                        <input id="content_blocker_start_tag" type="text" value="${extension_settings[extensionName].startTag}">
                    </div>
                    
                    <div class="content-blocker-tags">
                        <label>结束标签:</label>
                        <input id="content_blocker_end_tag" type="text" value="${extension_settings[extensionName].endTag}">
                    </div>
                    
                    <div>
                        <button id="content_blocker_update_list" class="menu_button">刷新提示列表</button>
                        <button id="content_blocker_preview_button" class="menu_button">预览屏蔽效果</button>
                    </div>
                    
                    <div id="content_blocker_prompt_list">
                        <h4>提示列表（取消勾选的项将被屏蔽）:</h4>
                        <div id="content_blocker_prompts"></div>
                    </div>
                    
                    <div>
                        <h4>预览:</h4>
                        <div id="content_blocker_preview"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 检查元素是否已存在，避免重复添加
    if ($('#content_blocker_settings').length === 0) {
        $('#extensions_settings2').append(settingsHtml);
        
        // 添加事件监听器
        $('#content_blocker_enabled').on('change', function() {
            extension_settings[extensionName].enabled = $(this).prop('checked');
            saveSettingsDebounced();
        });
        
        $('#content_blocker_start_tag').on('input', function() {
            extension_settings[extensionName].startTag = $(this).val();
            saveSettingsDebounced();
        });
        
        $('#content_blocker_end_tag').on('input', function() {
            extension_settings[extensionName].endTag = $(this).val();
            saveSettingsDebounced();
        });
        
        $('#content_blocker_update_list').on('click', function() {
            updatePromptListUI();
        });
        
        $('#content_blocker_preview_button').on('click', function() {
            previewBlockedContent();
        });
        
        // 初始化UI
        updateUI();
        console.log('内容屏蔽器UI已添加');
    } else {
        console.log('内容屏蔽器UI已存在，跳过添加');
    }
}

/**
 * 更新UI
 */
function updateUI() {
    // 确保元素存在
    if ($('#content_blocker_enabled').length > 0) {
        // 更新复选框
        $('#content_blocker_enabled').prop('checked', extension_settings[extensionName].enabled);
        
        // 更新标签输入
        $('#content_blocker_start_tag').val(extension_settings[extensionName].startTag);
        $('#content_blocker_end_tag').val(extension_settings[extensionName].endTag);
        
        // 更新提示列表
        updatePromptListUI();
    }
}

/**
 * 更新提示列表UI
 */
function updatePromptListUI() {
    const promptsContainer = $('#content_blocker_prompts');
    if (!promptsContainer.length) return;
    
    promptsContainer.empty();
    
    const { lastPromptList, whitelistedPrompts } = extension_settings[extensionName];
    
    if (!lastPromptList || lastPromptList.length === 0) {
        promptsContainer.append('<div>尚无提示数据。请先发送一条消息，然后点击"刷新提示列表"。</div>');
        return;
    }
    
    lastPromptList.forEach((prompt, index) => {
        const isWhitelisted = whitelistedPrompts.includes(index);
        const promptPreview = prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt;
        
        const promptHtml = `
            <div class="content-blocker-checkbox">
                <label>
                    <input type="checkbox" data-index="${index}" ${isWhitelisted ? 'checked' : ''}>
                    <span>提示 #${index + 1}</span>
                </label>
                <div class="content-blocker-prompt-item">${promptPreview}</div>
            </div>
        `;
        
        promptsContainer.append(promptHtml);
    });
    
    // 添加复选框事件监听器
    promptsContainer.find('input[type="checkbox"]').on('change', function() {
        const index = parseInt($(this).data('index'));
        const isChecked = $(this).prop('checked');
        
        if (isChecked) {
            // 如果勾选，添加到白名单
            if (!extension_settings[extensionName].whitelistedPrompts.includes(index)) {
                extension_settings[extensionName].whitelistedPrompts.push(index);
            }
        } else {
            // 如果取消勾选，从白名单中移除
            extension_settings[extensionName].whitelistedPrompts = extension_settings[extensionName].whitelistedPrompts.filter(i => i !== index);
        }
        
        saveSettingsDebounced();
    });
}

/**
 * 预览屏蔽效果
 */
function previewBlockedContent() {
    const previewContainer = $('#content_blocker_preview');
    if (!previewContainer.length) return;
    
    previewContainer.empty();
    
    const { lastPromptList, whitelistedPrompts, startTag, endTag } = extension_settings[extensionName];
    
    if (!lastPromptList || lastPromptList.length === 0) {
        previewContainer.append('<div>尚无提示数据可供预览。</div>');
        return;
    }
    
    lastPromptList.forEach((prompt, index) => {
        const isWhitelisted = whitelistedPrompts.includes(index);
        
        // 为预览创建一个新的文本副本
        let previewText = prompt;
        
        // 在预览中突出显示标签包裹的内容
        if (startTag && endTag) {
            const escapedStartTag = escapeRegExp(startTag);
            const escapedEndTag = escapeRegExp(endTag);
            const regex = new RegExp(`(${escapedStartTag}.*?${escapedEndTag})`, 'gs');
            
            previewText = previewText.replace(regex, (match) => {
                if (isWhitelisted) {
                    return `<span class="content-blocker-highlighted">${match}</span>`;
                } else {
                    return `<span class="content-blocker-blocked">${match}</span>`;
                }
            });
        }
        
        const previewHtml = `
            <div>
                <h5>提示 #${index + 1} (${isWhitelisted ? '不屏蔽' : '屏蔽'})</h5>
                <pre>${previewText}</pre>
            </div>
        `;
        
        previewContainer.append(previewHtml);
    });
}

/**
 * 注册斜杠命令
 */
function registerCommands() {
    try {
        // 设置内容屏蔽标签命令
        registerSlashCommand('blockcontent', (args) => {
            if (args.length < 2) {
                toastr.warning('请指定开始和结束标签，例如: /blockcontent <tag> </tag>');
                return;
            }
            
            extension_settings[extensionName].startTag = args[0];
            extension_settings[extensionName].endTag = args[1];
            saveSettingsDebounced();
            updateUI();
            
            toastr.success(`内容屏蔽标签已设置为 ${args[0]} 和 ${args[1]}`);
        }, [], '<start_tag> <end_tag>', '设置内容屏蔽的开始和结束标签');
        
        // 启用/禁用内容屏蔽器命令
        registerSlashCommand('toggleblocker', () => {
            extension_settings[extensionName].enabled = !extension_settings[extensionName].enabled;
            saveSettingsDebounced();
            updateUI();
            
            toastr.success(`内容屏蔽器已${extension_settings[extensionName].enabled ? '启用' : '禁用'}`);
        }, [], '', '启用/禁用内容屏蔽器');
        
        console.log('内容屏蔽器命令已注册');
    } catch (error) {
        console.error('注册斜杠命令失败:', error);
    }
}

/**
 * 扩展初始化函数
 */
function loadContentBlockerExtension() {
    initSettings();
    
    // 监听提示生成前事件
    eventSource.on('generate_before_combine_prompts', onBeforeCombinePrompts);
    
    // 监听聊天改变事件，用于更新当前提示列表
    eventSource.on('chat_changed', updatePromptList);
    
    // 注册斜杠命令
    registerCommands();
    
    // 添加UI延迟执行，确保DOM已加载
    setTimeout(addExtensionUI, 2000);
    
    console.log('内容屏蔽器扩展已加载');
}

// 导出模块
window["content-blocker"] = {
    name: '内容屏蔽器',
    initialize: loadContentBlockerExtension
}; 