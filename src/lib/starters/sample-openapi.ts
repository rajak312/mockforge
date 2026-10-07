/** A compact OpenAPI 3 document used by "Load sample" in the import dialog. */
export const SAMPLE_OPENAPI = `openapi: 3.0.3
info:
  title: Task Manager API
  version: 1.2.0
  description: Projects, tasks and team members for a small productivity app.
servers:
  - url: https://tasks.example.com/v1
paths:
  /projects:
    get:
      summary: List projects
      responses:
        '200':
          description: Projects
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/Project' }
  /projects/{projectId}/tasks:
    get:
      summary: List tasks in a project
      parameters:
        - { name: projectId, in: path, required: true, schema: { type: string } }
      responses:
        '200':
          description: Tasks
          content:
            application/json:
              schema:
                type: array
                minItems: 3
                maxItems: 6
                items: { $ref: '#/components/schemas/Task' }
    post:
      summary: Create a task
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Task' }
        '422':
          description: Validation failed
          content:
            application/json:
              example: { error: validation_failed, fields: { title: Title is required } }
  /tasks/{taskId}:
    get:
      summary: Get a task
      responses:
        '200':
          description: Task
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Task' }
        '404':
          description: Not found
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }
    delete:
      summary: Delete a task
      responses:
        '204': { description: Deleted }
  /members/{memberId}:
    get:
      summary: Get a team member
      responses:
        '200':
          description: Member
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: string, format: uuid }
                  name: { type: string }
                  email: { type: string, format: email }
                  avatar: { type: string }
                  role: { type: string, enum: [owner, admin, member] }
components:
  schemas:
    Project:
      type: object
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        color: { type: string }
        openTasks: { type: integer, minimum: 0, maximum: 40 }
        createdAt: { type: string, format: date-time }
    Task:
      type: object
      required: [id, title]
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        description: { type: string }
        status: { type: string, enum: [todo, in_progress, done] }
        priority: { type: integer, minimum: 1, maximum: 4 }
        assignee:
          type: object
          properties:
            name: { type: string }
            email: { type: string, format: email }
        tags:
          type: array
          items: { type: string }
        dueDate: { type: string, format: date-time }
    Error:
      type: object
      properties:
        code: { type: integer, minimum: 400, maximum: 499 }
        message: { type: string }
`
