import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { templateAPI, Template } from '../services/api';

interface TemplateManagerProps {
  selectedClientId: string;
}

export default function TemplateManager({ selectedClientId }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    trigger: '',
    template: '',
  });

  useEffect(() => {
    if (selectedClientId) {
      loadTemplates();
    }
  }, [selectedClientId]);

  const loadTemplates = async () => {
    if (!selectedClientId) return;
    
    setLoading(true);
    try {
      const response = await templateAPI.getTemplates(selectedClientId);
      setTemplates(response.templates);
      setCategories(response.categories);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;

    try {
      await templateAPI.createTemplate(selectedClientId, formData);
      setFormData({ name: '', category: '', trigger: '', template: '' });
      setShowCreateForm(false);
      loadTemplates();
    } catch (error: any) {
      console.error('Failed to create template:', error);
      alert(error.response?.data?.error || 'Failed to create template');
    }
  };

  const updateTemplate = async (template: Template) => {
    if (!selectedClientId) return;

    try {
      await templateAPI.updateTemplate(selectedClientId, template.id, {
        name: template.name,
        category: template.category,
        trigger: template.trigger,
        template: template.template,
      });
      setEditingTemplate(null);
      loadTemplates();
    } catch (error: any) {
      console.error('Failed to update template:', error);
      alert(error.response?.data?.error || 'Failed to update template');
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!selectedClientId) return;
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await templateAPI.deleteTemplate(selectedClientId, templateId);
      loadTemplates();
    } catch (error: any) {
      console.error('Failed to delete template:', error);
      alert(error.response?.data?.error || 'Failed to delete template');
    }
  };

  const startEditing = (template: Template) => {
    setEditingTemplate({ ...template });
    setShowCreateForm(false);
  };

  const cancelEditing = () => {
    setEditingTemplate(null);
  };

  const handleEditingChange = (field: keyof Template, value: string) => {
    if (editingTemplate) {
      setEditingTemplate({ ...editingTemplate, [field]: value });
    }
  };

  if (!selectedClientId) {
    return (
      <div className="card text-center py-12">
        <Edit2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Select a client to manage their response templates</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Response Templates</h2>
          <p className="text-gray-600">Create and manage AI response templates for different scenarios</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </button>
      </div>

      {/* Create Template Form */}
      {showCreateForm && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Create New Template</h3>
          <form onSubmit={createTemplate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Template Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input-field"
                  placeholder="e.g., support, sales, general"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Trigger Keywords</label>
              <input
                type="text"
                value={formData.trigger}
                onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                className="input-field"
                placeholder="e.g., meeting, schedule, pricing"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Keywords that will trigger this template (comma-separated)
              </p>
            </div>
            <div>
              <label className="label">Template Content</label>
              <textarea
                value={formData.template}
                onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                className="input-field h-32"
                placeholder="Dear [sender],&#10;&#10;Thank you for your email...&#10;&#10;Best regards"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Use placeholders like [sender], [subject], [company] for dynamic content
              </p>
            </div>
            <div className="flex space-x-4">
              <button type="submit" className="btn-primary">
                Create Template
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Templates List */}
      <div className="space-y-4">
        {loading ? (
          <div className="card text-center py-8">
            <p className="text-gray-500">Loading templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="card text-center py-8">
            <Edit2 className="h-8 w-8 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No templates yet. Create your first template to get started.</p>
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="card">
              {editingTemplate?.id === template.id ? (
                // Edit mode
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Template Name</label>
                      <input
                        type="text"
                        value={editingTemplate.name}
                        onChange={(e) => handleEditingChange('name', e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Category</label>
                      <input
                        type="text"
                        value={editingTemplate.category}
                        onChange={(e) => handleEditingChange('category', e.target.value)}
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Trigger Keywords</label>
                    <input
                      type="text"
                      value={editingTemplate.trigger}
                      onChange={(e) => handleEditingChange('trigger', e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label">Template Content</label>
                    <textarea
                      value={editingTemplate.template}
                      onChange={(e) => handleEditingChange('template', e.target.value)}
                      className="input-field h-32"
                    />
                  </div>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => updateTemplate(editingTemplate)}
                      className="btn-primary flex items-center"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="btn-secondary flex items-center"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold">{template.name}</h3>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          {template.category}
                        </span>
                        {!template.isActive && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        <strong>Triggers:</strong> {template.trigger}
                      </p>
                      <p className="text-xs text-gray-500">
                        Created: {new Date(template.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEditing(template)}
                        className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-md hover:bg-blue-200"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteTemplate(template.id)}
                        className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-md hover:bg-red-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h4 className="text-sm font-medium mb-2">Template Content:</h4>
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                      {template.template}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Categories Summary */}
      {categories.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">Template Categories</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <span
                key={category}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                {category}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}