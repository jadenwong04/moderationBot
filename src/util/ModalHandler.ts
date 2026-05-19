export default class ModalHandler {
    private static instance: ModalHandler | null = null;
    private registry: Map<string, { object: any, callback_name: string }>;

    private constructor() {
        this.registry = new Map();
    }

    static get_instance(): ModalHandler {
        if (ModalHandler.instance == null) {
            ModalHandler.instance = new ModalHandler()
        }
        return ModalHandler.instance
    }

    register(event_id: string, object: any, callback_name: string): void {
        this.registry.set(event_id, { object, callback_name })
    }

    async submit(event_id: string, fields: any): Promise<any> {
        const registration = this.registry.get(event_id);
        if (!registration) {
            throw new Error(`No registration found for event_id: ${event_id}`);
        }
        const { object, callback_name } = registration;
        return await object[callback_name](fields)
    }

    unregister(id: string): void {
        this.registry.delete(id);
    }
}
