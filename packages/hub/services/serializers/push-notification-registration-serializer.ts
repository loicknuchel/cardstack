import { JSONAPIDocument } from '../../utils/jsonapi-document';
import { push_notification_registrations } from '@prisma/client';

export default class PushNotificationRegistrationSerializer {
  serialize(model: push_notification_registrations): JSONAPIDocument {
    const result = {
      data: {
        id: model.id,
        type: 'push-notification-registration',
        attributes: {
          'owner-address': model.owner_address,
          'push-client-id': model.push_client_id,
          'disabled-at': model.disabled_at,
        },
      },
    };

    return result as JSONAPIDocument;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'push-notification-registration-serializer': PushNotificationRegistrationSerializer;
  }
}
